import assert from "node:assert/strict";
import test from "node:test";

import { CliError } from "../src/lib/api.js";
import {
  buildKeyPermissions,
  parseMutableKeyStatus,
  validateApiKeyName,
} from "../src/lib/keys.js";

function assertCliError(fn: () => void, message: string): void {
  assert.throws(
    fn,
    (error) => error instanceof CliError && error.message === message
  );
}

test("buildKeyPermissions trims, dedupes, and combines model inputs", () => {
  assert.deepEqual(
    buildKeyPermissions({
      model: [" altllm-fast ", "altllm-standard"],
      models: "altllm-fast, altllm-basic",
    }),
    { models: ["altllm-fast", "altllm-standard", "altllm-basic"] }
  );
  assert.equal(buildKeyPermissions({}), undefined);
});

test("buildKeyPermissions rejects empty or invalid model lists", () => {
  assertCliError(
    () => buildKeyPermissions({ models: " , " }),
    "Provide at least one non-empty model ID."
  );
  assertCliError(
    () => buildKeyPermissions({ model: ["gpt-4"] }),
    "Invalid model ID: gpt-4. Model IDs must start with 'altllm-'."
  );
});

test("validateApiKeyName normalizes valid names and rejects unsafe names", () => {
  assert.equal(validateApiKeyName("  staging smoke-key.1  "), "staging smoke-key.1");
  assertCliError(() => validateApiKeyName("  "), "API key name cannot be empty.");
  assertCliError(
    () => validateApiKeyName("name/with/slash"),
    "API key name can only contain letters, numbers, spaces, hyphens, underscores, and periods."
  );
  assertCliError(
    () => validateApiKeyName("a".repeat(65)),
    "API key name must be 64 characters or fewer."
  );
});

test("parseMutableKeyStatus normalizes supported statuses", () => {
  assert.equal(parseMutableKeyStatus(" DISABLED "), "disabled");
  assertCliError(
    () => parseMutableKeyStatus("expired"),
    "Invalid API key status: expired. Expected one of active, disabled, revoked."
  );
});
