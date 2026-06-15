import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import { status } from "../src/commands/status.js";
import { usageByKey } from "../src/commands/usage-by-key.js";
import { usageByModel } from "../src/commands/usage-by-model.js";
import { usageTimeline } from "../src/commands/usage-timeline.js";
import { formatUtcMonth } from "../src/lib/history.js";
import type { PortalSession } from "../src/lib/session.js";

interface CapturedRequest {
  method: string | undefined;
  url: string | undefined;
  authorization: string | undefined;
}

async function writeSession(baseUrl: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "altllm-test-"));
  const sessionFile = join(dir, "session.json");
  const session: PortalSession = {
    baseUrl,
    token: "portal-test-token",
    user: {
      id: "user_123",
      email: "user@example.com",
      name: "Test User",
    },
  };

  await writeFile(sessionFile, JSON.stringify(session), "utf8");
  return sessionFile;
}

async function captureJson(fn: () => Promise<void>): Promise<Record<string, unknown>> {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    output += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;

  try {
    await fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return JSON.parse(output) as Record<string, unknown>;
}

async function withMockPortal(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  fn: (baseUrl: string, requests: CapturedRequest[]) => Promise<void>
): Promise<void> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    handler(request, response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert(address && typeof address === "object");

  try {
    await fn(`http://127.0.0.1:${address.port}`, requests);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function currentMonthRange(): { startDate: string; endDate: string } {
  const month = formatUtcMonth();
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

test("usage commands default to the current UTC month and send bearer auth", async () => {
  await withMockPortal(
    (_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    },
    async (baseUrl, requests) => {
      const sessionFile = await writeSession(baseUrl);
      await captureJson(() =>
        usageTimeline({
          baseUrl,
          sessionFile,
        })
      );
      await captureJson(() =>
        usageByModel({
          baseUrl,
          sessionFile,
        })
      );
      await captureJson(() =>
        usageByKey({
          baseUrl,
          sessionFile,
        })
      );

      const month = formatUtcMonth();
      const range = currentMonthRange();
      assert.deepEqual(
        requests.map((request) => request.url),
        [
          `/api/usage/timeline?month=${month}`,
          `/api/usage/by-model?month=${month}`,
          `/api/usage/by-key?start_date=${range.startDate}&end_date=${range.endDate}`,
        ]
      );
      assert.deepEqual(
        requests.map((request) => request.authorization),
        ["Bearer portal-test-token", "Bearer portal-test-token", "Bearer portal-test-token"]
      );
    }
  );
});

test("status reports session identity and target safety without exposing token", async () => {
  const sessionFile = await writeSession("https://platform-api.altllm.ai");
  const result = await captureJson(() =>
    status({
      baseUrl: "http://api.altllm.example",
      sessionFile,
    })
  );

  assert.equal(result.authenticated, true);
  assert.deepEqual(result.user, {
    id: "user_123",
    email: "user@example.com",
    name: "Test User",
  });
  assert.equal(JSON.stringify(result).includes("portal-test-token"), false);
  assert.deepEqual(result.session, {
    baseUrl: "https://platform-api.altllm.ai",
    origin: "https://platform-api.altllm.ai",
  });
  assert.deepEqual(result.target, {
    baseUrl: "http://api.altllm.example",
    origin: "http://api.altllm.example",
    matchesSession: false,
    secureForSessionToken: false,
    tokenHostMismatchAllowed: false,
    tokenForwardingAllowed: false,
    tokenForwardingError:
      "Refusing to send the saved Portal session token to insecure non-local base URL http://api.altllm.example. Use https:// for non-local targets.",
  });
});
