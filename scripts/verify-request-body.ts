import assert from "node:assert/strict";
import { readBoundedTextBody } from "../src/lib/request-body";

function streamedRequest(chunks: string[], contentLength?: number) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  const headers = new Headers({ "Content-Type": "application/json" });
  if (contentLength !== undefined) {
    headers.set("Content-Length", String(contentLength));
  }

  return new Request("https://rockedin.test/api/agent", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function main() {
  const exact = await readBoundedTextBody(
    streamedRequest(['{"ok":', "true}"]),
    11,
  );
  assert.deepEqual(exact, { ok: true, text: '{"ok":true}' });

  const missingLengthOversize = await readBoundedTextBody(
    streamedRequest(["12345", "67890"]),
    9,
  );
  assert.deepEqual(missingLengthOversize, {
    ok: false,
    reason: "too_large",
  });

  const forgedLengthOversize = await readBoundedTextBody(
    streamedRequest(["12345", "67890"], 2),
    9,
  );
  assert.deepEqual(forgedLengthOversize, {
    ok: false,
    reason: "too_large",
  });

  console.log(
    "Request body verification passed: exact, missing-length, and forged-length streams are bounded.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
