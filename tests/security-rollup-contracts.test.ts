import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { privateKeyToAccount } from "viem/accounts";

import { cloudClawLogs } from "../src/commands/cloud-claw-logs.js";
import { cloudClawMe } from "../src/commands/cloud-claw-me.js";
import { credit } from "../src/commands/credit.js";
import { loginWallet } from "../src/commands/login-wallet.js";

type FetchHandler = (
  url: URL,
  init: RequestInit
) => Response | Promise<Response>;

const PORTAL_BASE_URL = "http://127.0.0.1:7040";
const CLOUD_CLAW_BASE_URL = "http://127.0.0.1:7041";
const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const EXTERNAL_SIGNATURE = `0x${"a".repeat(130)}`;
const TEST_PRIVATE_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

async function createTempSessionPath(t: test.TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "altllm-cli-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return join(dir, "session.json");
}

async function writePortalSession(
  sessionFile: string,
  token = "portal-session-token"
): Promise<void> {
  await writeFile(
    sessionFile,
    JSON.stringify({
      baseUrl: PORTAL_BASE_URL,
      token,
      user: {
        id: "user-1",
        email: "user@example.test",
      },
    })
  );
}

function captureStdout(t: test.TestContext): () => string {
  const originalWrite = process.stdout.write;
  let output = "";

  process.stdout.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
    output += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
    if (typeof encoding === "function") {
      encoding();
    }
    if (typeof cb === "function") {
      cb();
    }
    return true;
  }) as typeof process.stdout.write;

  t.after(() => {
    process.stdout.write = originalWrite;
  });

  return () => output;
}

function mockFetch(t: test.TestContext, handler: FetchHandler): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url =
      input instanceof Request ? new URL(input.url) : new URL(String(input));
    return handler(url, init);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function requestHeaders(init: RequestInit): Headers {
  return new Headers(init.headers);
}

function requestBody(init: RequestInit): Record<string, unknown> {
  assert.equal(typeof init.body, "string");
  return JSON.parse(init.body as string);
}

function buildChallengeMessage(params: {
  walletAddress: string;
  nonce: string;
  expiresAt: string;
}): string {
  const issuedAt = new Date(Date.now() - 1_000).toISOString();
  return `localhost wants you to sign in with your Ethereum account:
${params.walletAddress}

Sign this message to log in to AltLLM Portal.

URI: http://localhost:7040/
Version: 1
Chain ID: 1
Nonce: ${params.nonce}
Issued At: ${issuedAt}
Expiration Time: ${params.expiresAt}`;
}

test("security rollup: external wallet verify opts into Portal token and saves it", async (t) => {
  const sessionFile = await createTempSessionPath(t);

  mockFetch(t, (url, init) => {
    assert.equal(url.href, `${PORTAL_BASE_URL}/api/auth/crypto/verify`);
    assert.equal(init.method, "POST");
    assert.equal(
      requestHeaders(init).get("x-altllm-return-portal-token"),
      "1"
    );
    assert.deepEqual(requestBody(init), {
      wallet_address: WALLET_ADDRESS,
      nonce: "nonce-1",
      signature: EXTERNAL_SIGNATURE,
    });

    return jsonResponse({
      token: "new-portal-token",
      user: {
        id: "user-1",
        email: "user@example.test",
      },
    });
  });

  captureStdout(t);
  await loginWallet({
    baseUrl: PORTAL_BASE_URL,
    walletAddress: WALLET_ADDRESS,
    privateKeyEnv: "ALTLLM_WALLET_PRIVATE_KEY",
    chainId: 1,
    nonce: "nonce-1",
    signature: EXTERNAL_SIGNATURE,
    sessionFile,
  });

  const session = JSON.parse(await readFile(sessionFile, "utf8"));
  assert.equal(session.token, "new-portal-token");
});

test("security rollup: local wallet verify also opts into Portal token", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const nonce = "local-nonce";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  let challengeRequested = false;
  let verifyRequested = false;

  mockFetch(t, (url, init) => {
    if (url.pathname === "/api/auth/crypto/challenge") {
      challengeRequested = true;
      assert.equal(init.method, "POST");
      assert.deepEqual(requestBody(init), {
        wallet_address: account.address,
        chain_id: 1,
      });

      return jsonResponse({
        wallet_address: account.address,
        chain_id: 1,
        nonce,
        message: buildChallengeMessage({
          walletAddress: account.address,
          nonce,
          expiresAt,
        }),
        expires_at: expiresAt,
      });
    }

    assert.equal(url.pathname, "/api/auth/crypto/verify");
    verifyRequested = true;
    assert.equal(
      requestHeaders(init).get("x-altllm-return-portal-token"),
      "1"
    );
    const body = requestBody(init);
    assert.equal(body.wallet_address, account.address);
    assert.equal(body.nonce, nonce);
    assert.match(String(body.signature), /^0x[a-fA-F0-9]+$/);

    return jsonResponse({
      token: "local-portal-token",
      user: {
        id: "user-2",
        email: "local@example.test",
      },
    });
  });

  captureStdout(t);
  await loginWallet({
    baseUrl: "http://localhost:7040",
    walletAddress: account.address,
    privateKey: TEST_PRIVATE_KEY,
    privateKeyEnv: "ALTLLM_WALLET_PRIVATE_KEY",
    allowUnsafePrivateKeyArgv: true,
    chainId: 1,
    sessionFile,
  });

  assert.equal(challengeRequested, true);
  assert.equal(verifyRequested, true);
  const session = JSON.parse(await readFile(sessionFile, "utf8"));
  assert.equal(session.token, "local-portal-token");
});

test("security rollup: wallet verify without token fails before writing a session", async (t) => {
  const sessionFile = await createTempSessionPath(t);

  mockFetch(t, () =>
    jsonResponse({
      user: {
        id: "user-1",
        email: "user@example.test",
      },
    })
  );

  await assert.rejects(
    loginWallet({
      baseUrl: PORTAL_BASE_URL,
      walletAddress: WALLET_ADDRESS,
      privateKeyEnv: "ALTLLM_WALLET_PRIVATE_KEY",
      chainId: 1,
      nonce: "nonce-1",
      signature: EXTERNAL_SIGNATURE,
      sessionFile,
    }),
    /did not include a session token/
  );
  await assert.rejects(readFile(sessionFile, "utf8"), /ENOENT/);
});

test("security rollup: saved Portal session 401 gives re-login guidance", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile, "stale-portal-token");

  mockFetch(t, (url, init) => {
    assert.equal(url.href, `${PORTAL_BASE_URL}/api/billing/balance`);
    assert.equal(requestHeaders(init).get("authorization"), "Bearer stale-portal-token");
    return textResponse("expired", 401);
  });

  await assert.rejects(
    credit({
      sessionFile,
    }),
    /Saved Portal session was rejected.*login-wallet/
  );
});

test("security rollup: Cloud Claw SSO success uses bearer JWT for JSON command", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile);
  const stdout = captureStdout(t);

  mockFetch(t, (url, init) => {
    if (url.pathname === "/api/auth/portal-sso") {
      assert.equal(init.method, "POST");
      assert.deepEqual(requestBody(init), {
        token: "portal-session-token",
        force: false,
      });
      return jsonResponse({
        authenticated: true,
        token: "cloud-claw-jwt",
      });
    }

    assert.equal(url.href, `${CLOUD_CLAW_BASE_URL}/api/auth/me`);
    assert.equal(requestHeaders(init).get("authorization"), "Bearer cloud-claw-jwt");
    return jsonResponse({
      id: "cloud-user",
    });
  });

  await cloudClawMe({
    baseUrl: CLOUD_CLAW_BASE_URL,
    sessionFile,
    allowTokenForwarding: true,
  });

  assert.deepEqual(JSON.parse(stdout()), {
    id: "cloud-user",
  });
});

test("security rollup: Cloud Claw SSO 401 points users to re-login", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile, "stale-portal-token");

  mockFetch(t, (url) => {
    assert.equal(url.pathname, "/api/auth/portal-sso");
    return textResponse("stale portal token", 401);
  });

  await assert.rejects(
    cloudClawMe({
      baseUrl: CLOUD_CLAW_BASE_URL,
      sessionFile,
      allowTokenForwarding: true,
    }),
    /portal-sso rejected the saved Portal session.*login-wallet/
  );
});

test("security rollup: Cloud Claw SSO 503 surfaces readiness guidance", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile);

  mockFetch(t, (url) => {
    assert.equal(url.pathname, "/api/auth/portal-sso");
    return textResponse("auth config unavailable", 503);
  });

  await assert.rejects(
    cloudClawMe({
      baseUrl: CLOUD_CLAW_BASE_URL,
      sessionFile,
      allowTokenForwarding: true,
    }),
    /portal-sso is unavailable.*security rollout/
  );
});

test("security rollup: Cloud Claw logs use bearer JWT", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile);
  const stdout = captureStdout(t);

  mockFetch(t, (url, init) => {
    if (url.pathname === "/api/auth/portal-sso") {
      return jsonResponse({
        token: "cloud-claw-jwt",
      });
    }

    assert.equal(url.href, `${CLOUD_CLAW_BASE_URL}/api/vm/deployments/demo/logs`);
    assert.equal(requestHeaders(init).get("authorization"), "Bearer cloud-claw-jwt");
    return textResponse("ready");
  });

  await cloudClawLogs({
    name: "demo",
    baseUrl: CLOUD_CLAW_BASE_URL,
    sessionFile,
    allowTokenForwarding: true,
  });

  assert.equal(stdout(), "ready\n");
});

test("security rollup: Cloud Claw stream logs use auth query JWT", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile);
  const stdout = captureStdout(t);

  mockFetch(t, (url, init) => {
    if (url.pathname === "/api/auth/portal-sso") {
      return jsonResponse({
        token: "cloud-claw-jwt",
      });
    }

    assert.equal(
      url.href,
      `${CLOUD_CLAW_BASE_URL}/api/vm/deployments/demo/logs/stream?auth=cloud-claw-jwt`
    );
    assert.equal(requestHeaders(init).get("authorization"), null);
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
          controller.close();
        },
      }),
      { status: 200 }
    );
  });

  await cloudClawLogs({
    name: "demo",
    baseUrl: CLOUD_CLAW_BASE_URL,
    sessionFile,
    allowTokenForwarding: true,
    stream: true,
  });

  assert.equal(stdout(), "data: ready\n\n");
});

test("security rollup: Cloud Claw log 403 keeps authorization guidance", async (t) => {
  const sessionFile = await createTempSessionPath(t);
  await writePortalSession(sessionFile);

  mockFetch(t, (url) => {
    if (url.pathname === "/api/auth/portal-sso") {
      return jsonResponse({
        token: "cloud-claw-jwt",
      });
    }

    return textResponse("deployment access denied", 403);
  });

  await assert.rejects(
    cloudClawLogs({
      name: "demo",
      baseUrl: CLOUD_CLAW_BASE_URL,
      sessionFile,
      allowTokenForwarding: true,
    }),
    /Cloud Claw denied GET \/api\/vm\/deployments\/demo\/logs.*authorized/
  );
});
