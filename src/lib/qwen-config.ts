const DEFAULT_MODELSCOPE_BASE_URL = "https://api-inference.modelscope.ai/v1";
const DEFAULT_MODEL_STUDIO_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODELSCOPE_SCENE_MODEL = "Qwen-Ambassador/Qwen3.7-Plus";
const DEFAULT_MODELSCOPE_REVIEW_MODEL = "Qwen-Ambassador/Qwen3.7-Max";
const DEFAULT_MODEL_STUDIO_SCENE_MODEL = "qwen3.7-plus";
const DEFAULT_MODEL_STUDIO_REVIEW_MODEL = "qwen3.7-max";
const DEFAULT_SCENE_TIMEOUT_MS = 60_000;
const DEFAULT_REVIEW_TIMEOUT_MS = 30_000;
const DEFAULT_SCENE_MAX_OUTPUT_TOKENS = 2_048;
const DEFAULT_REVIEW_MAX_OUTPUT_TOKENS = 1_024;
const MIN_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;
const MIN_OUTPUT_TOKENS = 64;
const MAX_OUTPUT_TOKENS = 8_192;

export type QwenModelPurpose = "scene" | "human_review";
export type QwenJsonMode = "prompt_only" | "response_format";
export type QwenProvider = "modelscope" | "model_studio";
export type QwenEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface QwenProviderConfig {
  apiKey: string;
  provider: QwenProvider;
  model: string;
  endpoint: string;
  jsonMode: QwenJsonMode;
  sendThinkingControl: boolean;
  requestTimeoutMs: number;
  maxOutputTokens: number;
}

export class QwenConfigurationError extends Error {}

function resolveProvider(
  environment: QwenEnvironment,
  configuredBaseUrl: string | undefined,
): QwenProvider {
  const configuredProvider = environment.QWEN_PROVIDER;
  if (
    configuredProvider !== undefined &&
    configuredProvider !== "modelscope" &&
    configuredProvider !== "model_studio"
  ) {
    throw new QwenConfigurationError(
      "QWEN_PROVIDER must be modelscope or model_studio.",
    );
  }

  if (configuredProvider) {
    return configuredProvider;
  }

  if (configuredBaseUrl) {
    const hostname = parseBaseUrl(configuredBaseUrl).hostname.toLowerCase();
    if (
      hostname === "api-inference.modelscope.ai" ||
      hostname === "api-inference.modelscope.cn"
    ) {
      return "modelscope";
    }
    if (
      hostname === "dashscope-intl.aliyuncs.com" ||
      hostname === "dashscope.aliyuncs.com" ||
      hostname === "dashscope-us.aliyuncs.com" ||
      hostname.endsWith(".maas.aliyuncs.com")
    ) {
      return "model_studio";
    }
    throw new QwenConfigurationError(
      "QWEN_BASE_URL must use an official ModelScope or Alibaba Cloud Model Studio endpoint.",
    );
  }

  if (environment.QWEN_API_KEY) {
    throw new QwenConfigurationError(
      "Set QWEN_PROVIDER or QWEN_BASE_URL when using the generic QWEN_API_KEY.",
    );
  }

  const hasModelScopeCredential = Boolean(
    environment.MODELSCOPE_API_TOKEN ?? environment.MODELSCOPE_API_KEY,
  );
  const hasModelStudioCredential = Boolean(environment.DASHSCOPE_API_KEY);
  if (hasModelScopeCredential && hasModelStudioCredential) {
    throw new QwenConfigurationError(
      "Set QWEN_PROVIDER when both ModelScope and Model Studio credentials are configured.",
    );
  }

  return hasModelStudioCredential ? "model_studio" : "modelscope";
}

function parseBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new QwenConfigurationError("QWEN_BASE_URL must be a valid URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new QwenConfigurationError(
      "QWEN_BASE_URL must be an HTTPS URL without credentials, query parameters, or fragments.",
    );
  }

  return url;
}

function resolveBaseUrl(
  environment: QwenEnvironment,
  provider: QwenProvider,
) {
  const configured =
    environment.QWEN_BASE_URL ?? environment.MODELSCOPE_BASE_URL;
  const value =
    configured ??
    (provider === "modelscope"
      ? DEFAULT_MODELSCOPE_BASE_URL
      : DEFAULT_MODEL_STUDIO_BASE_URL);
  const url = parseBaseUrl(value);
  const hostname = url.hostname.toLowerCase();
  const validHost =
    provider === "modelscope"
      ? hostname === "api-inference.modelscope.ai" ||
        hostname === "api-inference.modelscope.cn"
      : hostname === "dashscope-intl.aliyuncs.com" ||
        hostname === "dashscope.aliyuncs.com" ||
        hostname === "dashscope-us.aliyuncs.com" ||
        hostname.endsWith(".maas.aliyuncs.com");

  if (!validHost) {
    throw new QwenConfigurationError(
      provider === "modelscope"
        ? "ModelScope credentials require an official api-inference.modelscope endpoint."
        : "Model Studio credentials require an official Alibaba Cloud Model Studio endpoint.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

function resolveRequestTimeoutMs(
  environment: QwenEnvironment,
  purpose: QwenModelPurpose,
) {
  const configured =
    (purpose === "scene"
      ? environment.QWEN_SCENE_TIMEOUT_MS
      : environment.QWEN_REVIEW_TIMEOUT_MS) ??
    environment.QWEN_TIMEOUT_MS;

  if (configured === undefined) {
    return purpose === "scene"
      ? DEFAULT_SCENE_TIMEOUT_MS
      : DEFAULT_REVIEW_TIMEOUT_MS;
  }

  const timeoutMs = Number(configured);
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_REQUEST_TIMEOUT_MS ||
    timeoutMs > MAX_REQUEST_TIMEOUT_MS
  ) {
    throw new QwenConfigurationError(
      `Qwen request timeouts must be integers from ${MIN_REQUEST_TIMEOUT_MS} to ${MAX_REQUEST_TIMEOUT_MS} milliseconds.`,
    );
  }

  return timeoutMs;
}

function resolveMaxOutputTokens(
  environment: QwenEnvironment,
  purpose: QwenModelPurpose,
) {
  const configured =
    (purpose === "scene"
      ? environment.QWEN_SCENE_MAX_OUTPUT_TOKENS
      : environment.QWEN_REVIEW_MAX_OUTPUT_TOKENS) ??
    environment.QWEN_MAX_OUTPUT_TOKENS;

  if (configured === undefined) {
    return purpose === "scene"
      ? DEFAULT_SCENE_MAX_OUTPUT_TOKENS
      : DEFAULT_REVIEW_MAX_OUTPUT_TOKENS;
  }

  const maxOutputTokens = Number(configured);
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < MIN_OUTPUT_TOKENS ||
    maxOutputTokens > MAX_OUTPUT_TOKENS
  ) {
    throw new QwenConfigurationError(
      `Qwen output limits must be integers from ${MIN_OUTPUT_TOKENS} to ${MAX_OUTPUT_TOKENS} tokens.`,
    );
  }

  return maxOutputTokens;
}

export function resolveQwenConfig(
  environment: QwenEnvironment,
  purpose: QwenModelPurpose,
): QwenProviderConfig {
  const configuredBaseUrl =
    environment.QWEN_BASE_URL ?? environment.MODELSCOPE_BASE_URL;
  const provider = resolveProvider(environment, configuredBaseUrl);
  const baseUrl = resolveBaseUrl(environment, provider);
  const apiKey =
    environment.QWEN_API_KEY ??
    (provider === "modelscope"
      ? environment.MODELSCOPE_API_TOKEN ?? environment.MODELSCOPE_API_KEY
      : environment.DASHSCOPE_API_KEY);
  const defaultSceneModel =
    provider === "modelscope"
      ? DEFAULT_MODELSCOPE_SCENE_MODEL
      : DEFAULT_MODEL_STUDIO_SCENE_MODEL;
  const defaultReviewModel =
    provider === "modelscope"
      ? DEFAULT_MODELSCOPE_REVIEW_MODEL
      : DEFAULT_MODEL_STUDIO_REVIEW_MODEL;
  const model =
    purpose === "scene"
      ? environment.QWEN_SCENE_MODEL ??
        environment.QWEN_MODEL ??
        defaultSceneModel
      : environment.QWEN_REVIEW_MODEL ??
        environment.QWEN_MODEL ??
        defaultReviewModel;
  const configuredJsonMode =
    environment.QWEN_JSON_MODE ??
    (provider === "modelscope" ? "prompt_only" : "response_format");

  if (!apiKey) {
    throw new QwenConfigurationError(
      provider === "modelscope"
        ? "Qwen is not configured. Add MODELSCOPE_API_TOKEN or QWEN_API_KEY."
        : "Qwen is not configured. Add DASHSCOPE_API_KEY or QWEN_API_KEY.",
    );
  }
  if (
    provider === "modelscope" &&
    /^qwen3\./i.test(model)
  ) {
    throw new QwenConfigurationError(
      "ModelScope requires a repository-style model ID such as Qwen-Ambassador/Qwen3.7-Plus.",
    );
  }
  if (
    provider === "model_studio" &&
    /^Qwen-Ambassador\//i.test(model)
  ) {
    throw new QwenConfigurationError(
      "Model Studio requires a service model ID such as qwen3.7-plus or qwen3.7-max.",
    );
  }
  if (
    configuredJsonMode !== "prompt_only" &&
    configuredJsonMode !== "response_format"
  ) {
    throw new QwenConfigurationError(
      "QWEN_JSON_MODE must be prompt_only or response_format.",
    );
  }
  if (
    environment.QWEN_SEND_THINKING_CONTROL !== undefined &&
    environment.QWEN_SEND_THINKING_CONTROL !== "true" &&
    environment.QWEN_SEND_THINKING_CONTROL !== "false"
  ) {
    throw new QwenConfigurationError(
      "QWEN_SEND_THINKING_CONTROL must be true or false.",
    );
  }

  return {
    apiKey,
    provider,
    model,
    endpoint: baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`,
    jsonMode: configuredJsonMode,
    sendThinkingControl:
      environment.QWEN_SEND_THINKING_CONTROL !== "false",
    requestTimeoutMs: resolveRequestTimeoutMs(environment, purpose),
    maxOutputTokens: resolveMaxOutputTokens(environment, purpose),
  };
}
