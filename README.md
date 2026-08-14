# RockedIN

RockedIN is a Next.js demo that turns photos of Batu Bin Granite into an evolving corporate career.

## OpenAI model routing

- `gpt-5.6-luna` handles both photo understanding / structured scene events and the one-off "Review My Human" finale.
- The app uses the OpenAI Chat Completions contract with JSON mode enabled.
- Provider, credential, endpoint, and model IDs are validated as one tuple so supported provider settings cannot be mixed accidentally.
- Responses have purpose-specific token ceilings, provider deadlines, JSON validation, and one bounded repair attempt.

The scene and review paths remain separately configurable, so they can be split later if needed.

## Environment

Copy `.env.example` to `.env.local` and set the private credential.

### OpenAI

This is the configuration currently used by the demo:

```env
QWEN_PROVIDER=openai
OPENAI_API_KEY=
QWEN_BASE_URL=https://api.openai.com/v1
QWEN_SCENE_MODEL=gpt-5.6-luna
QWEN_REVIEW_MODEL=gpt-5.6-luna
QWEN_JSON_MODE=response_format
QWEN_SEND_THINKING_CONTROL=false
QWEN_SCENE_TIMEOUT_MS=60000
QWEN_REVIEW_TIMEOUT_MS=30000
QWEN_SCENE_MAX_OUTPUT_TOKENS=2048
QWEN_REVIEW_MAX_OUTPUT_TOKENS=1024
```

ModelScope and Alibaba Cloud Model Studio remain available as alternatives in `.env.example`. The credential is read only by server routes. Never prefix it with `NEXT_PUBLIC_`.

Scene interpretation is open-ended: the canonical rock jokes are examples,
not a whitelist. Any readable scene containing Batu can create a new generated
position, which is appended to the visible career trajectory.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use **Test OpenAI** to verify both model paths before the demo.

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
