import "server-only";

import { z } from "zod";
import {
  HumanReviewResultSchema,
  SceneEventResultSchema,
  type AgentRequest,
  type HumanReviewResult,
  type SceneEventResult,
} from "@/lib/schemas";
import {
  buildHumanReviewPrompt,
  buildSceneStatePrompt,
  ROCKEDIN_SYSTEM_PROMPT,
} from "@/lib/prompts";
import {
  QwenConfigurationError,
  resolveQwenConfig,
  type QwenModelPurpose,
} from "@/lib/qwen-config";

const ProviderEnvelopeSchema = z
  .object({
    model: z.string().optional(),
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.union([
                  z.string(),
                  z.array(
                    z
                      .object({
                        text: z.string(),
                      })
                      .passthrough(),
                  ),
                ]),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const ProviderErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
      })
      .passthrough()
      .optional(),
    errors: z
      .union([
        z
          .object({
            message: z.string().optional(),
          })
          .passthrough(),
        z
          .array(
            z
              .object({
                message: z.string().optional(),
              })
              .passthrough(),
          )
          .min(1),
      ])
      .optional(),
    message: z.string().optional(),
  })
  .passthrough();

const TRANSIENT_RETRY_DELAY_MS = 750;

export type AgentErrorCode =
  | "QWEN_CONFIG"
  | "QWEN_TIMEOUT"
  | "QWEN_NETWORK"
  | "QWEN_AUTH"
  | "QWEN_RATE_LIMIT"
  | "QWEN_INVALID_JSON"
  | "QWEN_SCHEMA_MISMATCH"
  | "QWEN_PROVIDER"
  | "UNKNOWN";

export class AgentServiceError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status: number,
  ) {
    super(message);
  }
}

function getConfig(purpose: QwenModelPurpose) {
  try {
    return resolveQwenConfig(process.env, purpose);
  } catch (error) {
    if (error instanceof QwenConfigurationError) {
      throw new AgentServiceError(
        "QWEN_CONFIG",
        error.message,
        false,
        503,
      );
    }
    throw new AgentServiceError(
      "QWEN_CONFIG",
      "AI provider configuration could not be loaded.",
      false,
      503,
    );
  }
}

function extractText(
  content: z.infer<
    typeof ProviderEnvelopeSchema
  >["choices"][number]["message"]["content"],
) {
  return typeof content === "string"
    ? content
    : content.map((part) => part.text).join("");
}

async function readProviderError(response: Response) {
  try {
    const parsed = ProviderErrorEnvelopeSchema.safeParse(await response.json());
    if (!parsed.success) {
      return undefined;
    }
    const errorsMessage = Array.isArray(parsed.data.errors)
      ? parsed.data.errors[0]?.message
      : parsed.data.errors?.message;
    return (
      parsed.data.error?.message ??
      errorsMessage ??
      parsed.data.message
    );
  } catch {
    return undefined;
  }
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AgentServiceError(
      "QWEN_INVALID_JSON",
      "The AI provider returned an invalid structured response.",
      true,
      502,
    );
  }
}

function timeoutError(purpose: QwenModelPurpose) {
  return new AgentServiceError(
    "QWEN_TIMEOUT",
    purpose === "scene"
      ? "The AI provider took too long to inspect this scene. The existing career was preserved; retry the image once."
      : "The AI provider took too long to complete the human review. Retry once.",
    true,
    504,
  );
}

async function providerCallOnce(
  config: ReturnType<typeof getConfig>,
  body: Record<string, unknown>,
  deadline: number,
  purpose: QwenModelPurpose,
) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw timeoutError(purpose);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remainingMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerMessage = await readProviderError(response);
      console.warn("AI provider request failed.", {
        purpose,
        model: config.model,
        status: response.status,
        message: providerMessage,
      });
      if (response.status === 401 || response.status === 403) {
        const needsAlibabaBinding = providerMessage
          ?.toLocaleLowerCase()
          .includes("bind your alibaba cloud account");
        throw new AgentServiceError(
          "QWEN_AUTH",
          needsAlibabaBinding
            ? "ModelScope requires this account to be linked to Alibaba Cloud before the Qwen credits can be used."
            : "The AI provider rejected the configured credentials or model access.",
          false,
          503,
        );
      }
      if (response.status === 429) {
        throw new AgentServiceError(
          "QWEN_RATE_LIMIT",
          "The AI provider reached its request limit. Wait before retrying or switch the configured model.",
          true,
          429,
        );
      }
      throw new AgentServiceError(
        "QWEN_PROVIDER",
        response.status >= 500
          ? "The AI provider is temporarily unavailable. Retry in a moment."
          : "The AI provider rejected this request. Check the configured model and try again.",
        response.status === 429 || response.status >= 500,
        response.status >= 500 ? 503 : 502,
      );
    }

    let rawProvider: unknown;
    try {
      rawProvider = await response.json();
    } catch {
      throw new AgentServiceError(
        "QWEN_SCHEMA_MISMATCH",
        "The AI provider returned an unreadable response.",
        true,
        502,
      );
    }

    const provider = ProviderEnvelopeSchema.safeParse(rawProvider);
    if (!provider.success) {
      throw new AgentServiceError(
        "QWEN_SCHEMA_MISMATCH",
        "The AI provider returned an unexpected response.",
        true,
        502,
      );
    }

    return {
      text: extractText(provider.data.choices[0].message.content),
      model: provider.data.model ?? config.model,
    };
  } catch (error) {
    if (error instanceof AgentServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw timeoutError(purpose);
    }
    throw new AgentServiceError(
      "QWEN_NETWORK",
      "Unable to reach the AI provider. Check the network and try again.",
      true,
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function providerCall(
  messages: unknown[],
  temperature: number,
  deadline: number,
  purpose: QwenModelPurpose,
  options: {
    allowTransportRetry?: boolean;
    maxOutputTokens?: number;
  } = {},
) {
  const config = getConfig(purpose);
  const maxOutputTokens = options.maxOutputTokens ?? config.maxOutputTokens;
  const body = {
    model: config.model,
    messages,
    stream: false,
    ...(config.provider === "openai"
      ? {
          max_completion_tokens: maxOutputTokens,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
        }
      : {
          temperature,
          max_tokens: maxOutputTokens,
          ...(config.jsonMode === "response_format"
            ? { response_format: { type: "json_object" } }
            : {}),
          ...(config.sendThinkingControl ? { enable_thinking: false } : {}),
        }),
  };

  const attempts = options.allowTransportRetry === false ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await providerCallOnce(config, body, deadline, purpose);
    } catch (error) {
      const serviceError =
        error instanceof AgentServiceError
          ? error
          : new AgentServiceError(
              "UNKNOWN",
              "RockedIN Agent encountered an unexpected issue.",
              false,
              500,
            );
      const transientFailure =
        serviceError.code === "QWEN_NETWORK" ||
        (serviceError.code === "QWEN_PROVIDER" && serviceError.retryable);
      const remainingMs = deadline - Date.now();

      if (
        attempt === 0 &&
        attempts > 1 &&
        transientFailure &&
        remainingMs > TRANSIENT_RETRY_DELAY_MS
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS),
        );
        continue;
      }
      throw serviceError;
    }
  }

  throw new AgentServiceError(
    "UNKNOWN",
    "RockedIN Agent encountered an unexpected issue.",
    false,
    500,
  );
}

export async function runSceneEvent(
  input: Extract<AgentRequest, { mode: "scene_event" }>,
): Promise<{ result: SceneEventResult; model: string }> {
  const imageContent: unknown[] = input.previousImageDataUrl
    ? [
        { type: "text", text: "IMAGE 1 IS THE BEFORE SCENE." },
        {
          type: "image_url",
          image_url: { url: input.previousImageDataUrl },
        },
      ]
    : [
        {
          type: "text",
          text: "There is no BEFORE image. This is the initial scene.",
        },
      ];

  imageContent.push(
    { type: "text", text: "IMAGE 2 IS THE CURRENT AFTER SCENE." },
    { type: "image_url", image_url: { url: input.currentImageDataUrl } },
    { type: "text", text: buildSceneStatePrompt(input) },
  );

  const baseMessages = [
    { role: "system", content: ROCKEDIN_SYSTEM_PROMPT },
    { role: "user", content: imageContent },
  ];
  const deadline = Date.now() + getConfig("scene").requestTimeoutMs;
  let previousResponse = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages =
      attempt === 0
        ? baseMessages
        : [
            {
              role: "system",
              content: ROCKEDIN_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Repair the JSON below without re-analyzing the image.
Preserve its grounded scene interpretation and generated career idea.
Return only one corrected JSON object matching the required schema, with no
extra keys. A connection must use exactly name, title, and relationship.

ORIGINAL RESPONSE
${previousResponse}`,
            },
          ];

    try {
      const provider = await providerCall(
        messages,
        attempt === 0 ? 0.65 : 0.3,
        deadline,
        "scene",
        { allowTransportRetry: attempt === 0 },
      );
      previousResponse = provider.text;
      const result = SceneEventResultSchema.safeParse(parseJson(provider.text));
      if (!result.success) {
        throw new AgentServiceError(
          "QWEN_SCHEMA_MISMATCH",
          "The AI provider returned a career event that did not match the required schema.",
          true,
          502,
        );
      }
      return { result: result.data, model: provider.model };
    } catch (error) {
      const serviceError =
        error instanceof AgentServiceError
          ? error
          : new AgentServiceError(
              "UNKNOWN",
              "RockedIN Agent encountered an unexpected issue.",
              false,
              500,
            );
      const canCorrect =
        serviceError.code === "QWEN_INVALID_JSON" ||
        serviceError.code === "QWEN_SCHEMA_MISMATCH";
      if (attempt === 0 && canCorrect) {
        continue;
      }
      throw serviceError;
    }
  }

  throw new AgentServiceError(
    "UNKNOWN",
    "RockedIN Agent encountered an unexpected issue.",
    false,
    500,
  );
}

export async function runHumanReview(
  input: Extract<AgentRequest, { mode: "human_review" }>,
): Promise<{ result: HumanReviewResult; model: string }> {
  const messages = [
    {
      role: "system",
      content:
        "You are a precise corporate HR writer. Return valid JSON only. Never include Markdown or hidden reasoning.",
    },
    { role: "user", content: buildHumanReviewPrompt(input) },
  ];
  const deadline = Date.now() + getConfig("human_review").requestTimeoutMs;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptMessages =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "user",
              content:
                "CORRECTION: Return exactly the requested JSON object with three observations and a final post under 65 words.",
            },
          ];
    try {
      const provider = await providerCall(
        attemptMessages,
        attempt === 0 ? 0.6 : 0.25,
        deadline,
        "human_review",
        { allowTransportRetry: attempt === 0 },
      );
      const result = HumanReviewResultSchema.safeParse(parseJson(provider.text));
      if (!result.success) {
        throw new AgentServiceError(
          "QWEN_SCHEMA_MISMATCH",
          "The AI provider returned a human review that did not match the required schema.",
          true,
          502,
        );
      }
      return { result: result.data, model: provider.model };
    } catch (error) {
      const serviceError =
        error instanceof AgentServiceError
          ? error
          : new AgentServiceError(
              "UNKNOWN",
              "RockedIN Agent encountered an unexpected issue.",
              false,
              500,
            );
      const canCorrect =
        serviceError.code === "QWEN_INVALID_JSON" ||
        serviceError.code === "QWEN_SCHEMA_MISMATCH";
      if (attempt === 0 && canCorrect) {
        continue;
      }
      throw serviceError;
    }
  }

  throw new AgentServiceError(
    "UNKNOWN",
    "RockedIN Agent encountered an unexpected issue.",
    false,
    500,
  );
}

export async function runHealthCheck() {
  const deadline = Date.now() + 30_000;
  const messages = [
    {
      role: "system",
      content: "Return valid JSON only. Do not include Markdown.",
    },
    {
      role: "user",
      content: 'Return this JSON exactly: {"status":"rock solid"}',
    },
  ];
  const healthSchema = z.object({ status: z.literal("rock solid") }).strict();

  const checkModel = async (purpose: QwenModelPurpose) => {
    const provider = await providerCall(messages, 0, deadline, purpose, {
      maxOutputTokens: 64,
    });
    const result = healthSchema.safeParse(parseJson(provider.text));
    if (!result.success) {
      throw new AgentServiceError(
        "QWEN_SCHEMA_MISMATCH",
        "The AI provider health check returned an unexpected response.",
        true,
        502,
      );
    }
    return provider.model;
  };

  const [sceneModel, reviewModel] = await Promise.all([
    checkModel("scene"),
    checkModel("human_review"),
  ]);

  return {
    status: "rock solid" as const,
    model: `${sceneModel} + ${reviewModel}`,
    models: {
      scene: sceneModel,
      humanReview: reviewModel,
    },
  };
}
