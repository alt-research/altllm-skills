import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { cloudClawLogs } from "../src/commands/cloud-claw-logs.js";
import {
  getCloudClawJwt,
  requestCloudClawJson,
} from "../src/lib/cloud-claw.js";

const CLOUD_CLAW_BASE_URL = "https://claw.altllm.ai";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

async function withSessionFile<T>(
  callback: (sessionFile: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "altllm-cloud-claw-test-"));
  const sessionFile = join(dir, "session.json");
  await writeFile(
    sessionFile,
    JSON.stringify({
      baseUrl: "https://platform-api.altllm.ai",
      token: "saved-portal-token",
      user: {
        id: "user_123",
        email: "user@example.com",
      },
    }),
    "utf8"
  );

  try {
    return await callback(sessionFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withFetchResponses<T>(
  responses: Response[],
  callback: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const pending = [...responses];
  globalThis.fetch = (async () => {
    const response = pending.shift();
    if (!response) {
      throw new Error("Unexpected fetch call");
    }
    return response;
  }) as typeof fetch;

  try {
    const result = await callback();
    assert.equal(pending.length, 0, "all mocked responses should be used");
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("portal-sso 401 gives saved-session re-login guidance", async () => {
  await withSessionFile(async (sessionFile) => {
    await withFetchResponses(
      [jsonResponse({ error: "session expired" }, 401)],
      async () => {
        await assert.rejects(
          () => getCloudClawJwt({ sessionFile }),
          (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /portal-sso rejected/);
            assert.match(error.message, /altllm login-wallet/);
            assert.match(error.message, /session expired/);
            return true;
          }
        );
      }
    );
  });
});

test("portal-sso 503 points to rollout or availability problems", async () => {
  await withSessionFile(async (sessionFile) => {
    await withFetchResponses(
      [jsonResponse({ message: "auth service unavailable" }, 503)],
      async () => {
        await assert.rejects(
          () => getCloudClawJwt({ sessionFile }),
          (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /portal-sso is unavailable/);
            assert.match(error.message, /security rollout/);
            assert.match(error.message, /auth service unavailable/);
            return true;
          }
        );
      }
    );
  });
});

test("Cloud Claw command 403 preserves authorization context", async () => {
  await withSessionFile(async (sessionFile) => {
    await withFetchResponses(
      [
        jsonResponse({ token: "cloud-claw-jwt" }),
        jsonResponse({ detail: "not allowed for this deployment" }, 403),
      ],
      async () => {
        await assert.rejects(
          () =>
            requestCloudClawJson({
              method: "GET",
              path: "/api/vm/deployments",
              sessionFile,
            }),
          (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Cloud Claw denied GET \/api\/vm\/deployments/);
            assert.match(error.message, /HTTP 403/);
            assert.match(error.message, /not allowed for this deployment/);
            return true;
          }
        );
      }
    );
  });
});

test("one-shot logs use Cloud Claw authorization guidance", async () => {
  await withSessionFile(async (sessionFile) => {
    await withFetchResponses(
      [
        jsonResponse({ token: "cloud-claw-jwt" }),
        jsonResponse({ detail: "paid resource required" }, 403),
      ],
      async () => {
        await assert.rejects(
          () =>
            cloudClawLogs({
              name: "swift-owl-9",
              sessionFile,
            }),
          (error) => {
            assert.ok(error instanceof Error);
            assert.match(
              error.message,
              /Cloud Claw denied GET \/api\/vm\/deployments\/swift-owl-9\/logs/
            );
            assert.match(error.message, /paid resource required/);
            return true;
          }
        );
      }
    );
  });
});

test("log stream setup uses Cloud Claw auth signing guidance", async () => {
  await withSessionFile(async (sessionFile) => {
    await withFetchResponses(
      [
        jsonResponse({ token: "cloud-claw-jwt" }),
        textResponse("jwt invalid", 401),
      ],
      async () => {
        await assert.rejects(
          () =>
            cloudClawLogs({
              name: "swift-owl-9",
              sessionFile,
              stream: true,
            }),
          (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Cloud Claw rejected the session JWT/);
            assert.match(error.message, /auth signing may be misconfigured/);
            assert.match(error.message, /jwt invalid/);
            return true;
          }
        );
      }
    );
  });
});

test("Cloud Claw JSON success output remains parseable", async () => {
  await withSessionFile(async (sessionFile) => {
    const result = await withFetchResponses(
      [
        jsonResponse({ token: "cloud-claw-jwt" }),
        jsonResponse({ deployments: [] }),
      ],
      async () =>
        requestCloudClawJson<{ deployments: unknown[] }>({
          method: "GET",
          path: "/api/vm/deployments",
          baseUrl: CLOUD_CLAW_BASE_URL,
          sessionFile,
        })
    );

    assert.deepEqual(result, { deployments: [] });
  });
});
