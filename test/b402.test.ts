import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { CliError } from "../src/lib/api.js";
import { requestB402, signB402Payload } from "../src/commands/b402.js";

function testPrivateKeyB64(): {
  privateKeyB64: string;
  publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"];
} {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const der = pair.privateKey.export({ format: "der", type: "pkcs8" });
  return {
    privateKeyB64: Buffer.from(der).toString("base64"),
    publicKey: pair.publicKey,
  };
}

test("signB402Payload signs body plus millisecond timestamp", () => {
  const { privateKeyB64, publicKey } = testPrivateKeyB64();
  const body = "{}";
  const timestamp = "1760000000000";
  const signature = signB402Payload({
    body,
    timestamp,
    privateKey: privateKeyB64,
  });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(body + timestamp, "utf8");
  verifier.end();

  assert.equal(
    verifier.verify(publicKey, Buffer.from(signature, "base64")),
    true
  );
});

test("requestB402 sends signed Tesla headers", async () => {
  const { privateKeyB64 } = testPrivateKeyB64();
  const previousFetch = globalThis.fetch;
  const previousToken = process.env.B402_ACCESS_TOKEN;
  const previousKey = process.env.B402_PRIVATE_KEY_B64;
  let captured: { url?: string; init?: RequestInit } = {};
  process.env.B402_ACCESS_TOKEN = "access-token";
  process.env.B402_PRIVATE_KEY_B64 = privateKeyB64;
  globalThis.fetch = async (input, init) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await requestB402("supported", {
      baseUrl: "https://b402.example",
      clientId: "client-id",
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(
      captured.url,
      "https://b402.example/papi/v2/b402/supported"
    );
    const headers = captured.init?.headers as Record<string, string>;
    assert.equal(headers["X-Tesla-ClientId"], "client-id");
    assert.equal(headers["X-Tesla-SignAccessToken"], "access-token");
    assert.match(headers["X-Tesla-Timestamp"], /^\d{13}$/);
    assert.ok(headers["X-Tesla-Signature"]);
    assert.equal(captured.init?.body, "{}");
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("B402_ACCESS_TOKEN", previousToken);
    restoreEnv("B402_PRIVATE_KEY_B64", previousKey);
  }
});

test("requestB402 requires body files for verify and settle", async () => {
  await assert.rejects(
    () =>
      requestB402("verify", {
        baseUrl: "https://b402.example",
        clientId: "client-id",
      }),
    (error) =>
      error instanceof CliError &&
      error.message === "--body-file is required for b402-verify."
  );
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
