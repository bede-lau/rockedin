import { AgentServiceError, runHealthCheck } from "@/lib/qwen";

export const runtime = "nodejs";
export const maxDuration = 35;

export async function POST() {
  const startedAt = performance.now();

  try {
    const result = await runHealthCheck();
    return Response.json({
      ok: true,
      status: result.status,
      model: result.model,
      models: result.models,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
      live: true,
    });
  } catch (error) {
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
          message: "The service health check failed unexpectedly.",
          retryable: false,
        },
      },
      { status: 500 },
    );
  }
}
