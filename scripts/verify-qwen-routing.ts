import assert from "node:assert/strict";
import {
  QwenConfigurationError,
  resolveQwenConfig,
} from "../src/lib/qwen-config";

const modelScopeEnvironment = {
  QWEN_PROVIDER: "modelscope",
  MODELSCOPE_API_TOKEN: "test-token",
  QWEN_BASE_URL: "https://api-inference.modelscope.ai/v1",
  QWEN_SCENE_MODEL: "Qwen-Ambassador/Qwen3.7-Plus",
  QWEN_REVIEW_MODEL: "Qwen-Ambassador/Qwen3.7-Max",
  QWEN_JSON_MODE: "prompt_only",
};

const scene = resolveQwenConfig(modelScopeEnvironment, "scene");
const review = resolveQwenConfig(modelScopeEnvironment, "human_review");

assert.equal(scene.model, "Qwen-Ambassador/Qwen3.7-Plus");
assert.equal(review.model, "Qwen-Ambassador/Qwen3.7-Max");
assert.equal(scene.provider, "modelscope");
assert.equal(review.provider, "modelscope");
assert.equal(
  scene.endpoint,
  "https://api-inference.modelscope.ai/v1/chat/completions",
);
assert.equal(scene.jsonMode, "prompt_only");
assert.equal(scene.sendThinkingControl, true);
assert.equal(scene.requestTimeoutMs, 60_000);
assert.equal(scene.maxOutputTokens, 2_048);
assert.equal(review.jsonMode, "prompt_only");
assert.equal(review.sendThinkingControl, true);
assert.equal(review.requestTimeoutMs, 30_000);
assert.equal(review.maxOutputTokens, 1_024);

const modelScopeWithoutThinkingControl = resolveQwenConfig(
  {
    ...modelScopeEnvironment,
    QWEN_SEND_THINKING_CONTROL: "false",
  },
  "scene",
);
assert.equal(modelScopeWithoutThinkingControl.sendThinkingControl, false);

const modelScopeWithCustomTimeouts = resolveQwenConfig(
  {
    ...modelScopeEnvironment,
    QWEN_TIMEOUT_MS: "45000",
    QWEN_SCENE_TIMEOUT_MS: "35000",
  },
  "scene",
);
assert.equal(modelScopeWithCustomTimeouts.requestTimeoutMs, 35_000);

const modelStudio = resolveQwenConfig(
  {
    QWEN_PROVIDER: "model_studio",
    DASHSCOPE_API_KEY: "test-key",
  },
  "scene",
);
assert.equal(modelStudio.provider, "model_studio");
assert.equal(modelStudio.model, "qwen3.7-plus");
assert.equal(
  modelStudio.endpoint,
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
);
assert.equal(modelStudio.jsonMode, "response_format");
assert.equal(modelStudio.sendThinkingControl, true);

const modelStudioUs = resolveQwenConfig(
  {
    QWEN_PROVIDER: "model_studio",
    DASHSCOPE_API_KEY: "test-key",
    QWEN_BASE_URL:
      "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
  },
  "human_review",
);
assert.equal(
  modelStudioUs.endpoint,
  "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions",
);
assert.equal(modelStudioUs.model, "qwen3.7-max");

assert.throws(
  () => resolveQwenConfig({}, "scene"),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () => resolveQwenConfig({ QWEN_API_KEY: "ambiguous-key" }, "scene"),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        ...modelScopeEnvironment,
        QWEN_SEND_THINKING_CONTROL: "sometimes",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        ...modelScopeEnvironment,
        QWEN_TIMEOUT_MS: "2000",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        QWEN_PROVIDER: "model_studio",
        DASHSCOPE_API_KEY: "test-key",
        QWEN_BASE_URL: "https://api-inference.modelscope.ai/v1",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        ...modelScopeEnvironment,
        QWEN_BASE_URL: "http://api-inference.modelscope.ai/v1",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        QWEN_PROVIDER: "model_studio",
        DASHSCOPE_API_KEY: "test-key",
        QWEN_SCENE_MODEL: "Qwen-Ambassador/Qwen3.7-Plus",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);
assert.throws(
  () =>
    resolveQwenConfig(
      {
        ...modelScopeEnvironment,
        QWEN_SCENE_MAX_OUTPUT_TOKENS: "32",
      },
      "scene",
    ),
  (error) => error instanceof QwenConfigurationError,
);

console.log(
  "Qwen routing verification passed: provider tuples, model purposes, HTTPS endpoints, output limits, and thinking controls are valid.",
);
