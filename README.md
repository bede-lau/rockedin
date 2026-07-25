# RockedIN

RockedIN is a Next.js demo that turns photos of Batu Bin Granite into an evolving corporate career.

## Qwen model routing

- `Qwen-Ambassador/Qwen3.7-Plus` handles photo understanding and structured scene events.
- `Qwen-Ambassador/Qwen3.7-Max` writes the one-off "Review My Human" finale.
- Both models use the OpenAI-compatible Chat Completions contract.
- Provider, credential, endpoint, and model IDs are validated as one tuple so ModelScope and Model Studio settings cannot be mixed accidentally.
- Responses have purpose-specific token ceilings, provider deadlines, JSON validation, and one bounded repair attempt.

The exact ModelScope scene and review payloads, including an uploaded JPEG, were live-tested successfully on July 25, 2026.

## Environment

Copy `.env.example` to `.env.local` and set the private credential.

### ModelScope

This is the configuration currently used by the demo:

```env
QWEN_PROVIDER=modelscope
MODELSCOPE_API_TOKEN=
QWEN_BASE_URL=https://api-inference.modelscope.ai/v1
QWEN_SCENE_MODEL=Qwen-Ambassador/Qwen3.7-Plus
QWEN_REVIEW_MODEL=Qwen-Ambassador/Qwen3.7-Max
QWEN_JSON_MODE=prompt_only
QWEN_SEND_THINKING_CONTROL=true
QWEN_SCENE_TIMEOUT_MS=60000
QWEN_REVIEW_TIMEOUT_MS=30000
QWEN_SCENE_MAX_OUTPUT_TOKENS=2048
QWEN_REVIEW_MAX_OUTPUT_TOKENS=1024
```

ModelScope API-Inference is a best-effort service without a production SLA. It is suitable when occasional provider downtime or exhausted credits are acceptable.

If ModelScope returns an account-binding error, complete the requested account setup in ModelScope before retrying.

### Alibaba Cloud Model Studio

For a provider-backed production service, use the matching Model Studio tuple:

```env
QWEN_PROVIDER=model_studio
DASHSCOPE_API_KEY=
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_SCENE_MODEL=qwen3.7-plus
QWEN_REVIEW_MODEL=qwen3.7-max
QWEN_JSON_MODE=response_format
QWEN_SEND_THINKING_CONTROL=true
QWEN_SCENE_TIMEOUT_MS=60000
QWEN_REVIEW_TIMEOUT_MS=30000
QWEN_SCENE_MAX_OUTPUT_TOKENS=2048
QWEN_REVIEW_MAX_OUTPUT_TOKENS=1024
```

Use a workspace-specific regional endpoint when one is available for the deployment. The credential is read only by server routes. Never prefix it with `NEXT_PUBLIC_`.

Scene interpretation is open-ended: the canonical rock jokes are examples,
not a whitelist. Any readable scene containing Batu can create a new generated
position, which is appended to the visible career trajectory.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use **Test Qwen** to verify both models before the demo.

## Deployment

- Deploy as a Next.js server application, not a static export.
- Configure the selected provider tuple in the production environment.
- Set the reverse proxy or platform request-body limit slightly above 3.5 MB so the application can enforce its own 3.5 MB limit.
- When using the generic `QWEN_API_KEY`, also set `QWEN_PROVIDER` or an official `QWEN_BASE_URL` so the key cannot be routed to the wrong provider.
- The agent route declares a 125-second maximum duration; the health route declares 35 seconds.
- Files added to `public/sample-images` are discovered during the build, so redeploy after changing them.

## Checks

```bash
npm run verify
npm run build
```
