import { AgentRequestSchema } from "@/lib/schemas";
import { readBoundedTextBody } from "@/lib/request-body";
import {
  AgentServiceError,
  runHumanReview,
  runSceneEvent,
} from "@/lib/qwen";

export const runtime = "nodejs";
export const maxDuration = 125;

const MAX_REQUEST_BYTES = 3_500_000;

function errorResponse(error: unknown) {
  if (error instanceof AgentServiceError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "RockedIN Agent encountered an unexpected issue.",
        retryable: false,
      },
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("application/json")) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "The RockedIN request must use application/json.",
          retryable: false,
        },
      },
      { status: 415 },
    );
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength =
    rawContentLength === null ? 0 : Number(rawContentLength);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "The RockedIN request has an invalid content length.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "IMAGE_TOO_LARGE",
          message: "The captured scene is too large. Retake or upload a smaller image.",
          retryable: false,
        },
      },
      { status: 413 },
    );
  }

  const startedAt = performance.now();

  try {
    const body = await readBoundedTextBody(request, MAX_REQUEST_BYTES);
    if (!body.ok) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "IMAGE_TOO_LARGE",
            message:
              "The captured scene is too large. Retake or upload a smaller image.",
            retryable: false,
          },
        },
        { status: 413 },
      );
    }
    const bodyText = body.text;

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "The RockedIN request was not valid JSON.",
            retryable: false,
          },
        },
        { status: 400 },
      );
    }

    const parsed = AgentRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "The RockedIN request did not match the required schema.",
            retryable: false,
          },
        },
        { status: 422 },
      );
    }

    if (parsed.data.mode === "scene_event") {
      const response = await runSceneEvent(parsed.data);
      return Response.json({
        ok: true,
        mode: "scene_event",
        result: response.result,
        model: response.model,
        latencyMs: Math.round(performance.now() - startedAt),
        live: true,
      });
    }

    const response = await runHumanReview(parsed.data);
    return Response.json({
      ok: true,
      mode: "human_review",
      result: response.result,
      model: response.model,
      latencyMs: Math.round(performance.now() - startedAt),
      live: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
