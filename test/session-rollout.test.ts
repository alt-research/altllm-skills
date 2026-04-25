import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import { credit } from "../src/commands/credit.js";
import { getCloudClawJwt } from "../src/lib/cloud-claw.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "altllm-session-rollout-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeSessionFile(params: {
  dir: string;
  baseUrl: string;
  token?: string;
}): Promise<string> {
  const sessionFile = join(params.dir, "portal-cli-session.json");
  await writeFile(
    sessionFile,
    JSON.stringify(
      {
        baseUrl: params.baseUrl,
        token: params.token ?? "pre-rollout-token",
        user: {
          id: "user_123",
          email: "user@example.com",
          name: null,
        },
      },
      null,
      2
    ),
    "utf8"
  );
  return sessionFile;
}

function mockFetch(
  handler: (params: {
    url: string;
    init?: RequestInit;
  }) => Response | Promise<Response>
): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return handler({ url, init });
  }) as typeof fetch;
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    chunks.push(String(chunk));
    const callback = args.find((arg): arg is () => void => typeof arg === "function");
    callback?.();
    return true;
  }) as typeof process.stdout.write;

  try {
    await fn();
    return chunks.join("");
  } finally {
    process.stdout.write = originalWrite;
  }
}

function assertReloginError(error: unknown): boolean {
  assert(error instanceof Error);
  assert.match(error.message, /Saved Portal session was rejected/);
  assert.match(error.message, /trust-domain rollout/);
  assert.match(error.message, /Run altllm login-wallet again/);
  assert.match(error.message, /session file was not deleted/);
  assert.doesNotMatch(error.message, /failed: 401/);
  assert.doesNotMatch(error.message, /failed: 403/);
  return true;
}

test("Portal API saved-session 401 returns a clear re-login error", async () => {
  await withTempDir(async (dir) => {
    const baseUrl = "http://127.0.0.1:7040";
    const sessionFile = await writeSessionFile({ dir, baseUrl });

    mockFetch(({ url, init }) => {
      assert.equal(url, `${baseUrl}/api/billing/balance`);
      assert.equal(init?.headers instanceof Headers, false);
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer pre-rollout-token"
      );
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
      });
    });

    await assert.rejects(
      () => credit({ baseUrl, sessionFile }),
      assertReloginError
    );

    const persistedSession = JSON.parse(await readFile(sessionFile, "utf8")) as {
      token: string;
    };
    assert.equal(persistedSession.token, "pre-rollout-token");
  });
});

test("Cloud Claw portal-sso 403 returns the saved-session re-login error", async () => {
  await withTempDir(async (dir) => {
    const sessionFile = await writeSessionFile({
      dir,
      baseUrl: "https://platform-api.altllm.ai",
    });
    const cloudClawBaseUrl = "http://127.0.0.1:7041";

    mockFetch(async ({ url, init }) => {
      assert.equal(url, `${cloudClawBaseUrl}/api/auth/portal-sso`);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        token: "pre-rollout-token",
        force: false,
      });
      return new Response(JSON.stringify({ error: "portal token rejected" }), {
        status: 403,
      });
    });

    await assert.rejects(
      () =>
        getCloudClawJwt({
          baseUrl: cloudClawBaseUrl,
          sessionFile,
          allowTokenForwarding: true,
        }),
      assertReloginError
    );
  });
});

test("valid saved sessions continue to return command JSON", async () => {
  await withTempDir(async (dir) => {
    const baseUrl = "http://127.0.0.1:7040";
    const sessionFile = await writeSessionFile({ dir, baseUrl, token: "valid-token" });

    mockFetch(({ url, init }) => {
      assert.equal(url, `${baseUrl}/api/billing/balance`);
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer valid-token"
      );
      return new Response(
        JSON.stringify({
          balance: 12.5,
          currency: "USD",
        }),
        { status: 200 }
      );
    });

    const stdout = await captureStdout(() => credit({ baseUrl, sessionFile }));
    assert.deepEqual(JSON.parse(stdout), {
      balance: 12.5,
      currency: "USD",
    });
  });
});
