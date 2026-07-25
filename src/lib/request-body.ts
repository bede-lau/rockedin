export type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" };

export async function readBoundedTextBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return { ok: true, text: chunks.join("") };
  } finally {
    reader.releaseLock();
  }
}
