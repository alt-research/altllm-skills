import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const walletAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const walletPrivateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const validSignature = `0x${"a".repeat(130)}`;
const user = {
  id: "user_123",
  email: "wallet@example.com",
  name: "Wallet User",
};

async function startPortalServer(handler) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let rawBody = "";
    for await (const chunk of request) {
      rawBody += chunk;
    }

    const body = rawBody ? JSON.parse(rawBody) : undefined;
    const entry = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body,
    };
    requests.push(entry);

    try {
      const result = await handler(entry);
      response.statusCode = result.status ?? 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(result.json ?? {}));
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  assert(address && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "altllm-login-wallet-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runCli(args, env = {}) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    env: {
      ...process.env,
      ALTLLM_HTTP_TIMEOUT_MS: "5000",
      ...env,
    },
    timeout: 10_000,
  });
}

async function runCliExpectFailure(args, env = {}) {
  try {
    await runCli(args, env);
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }

  assert.fail("Expected CLI command to fail.");
}

function buildChallengeMessage({ baseUrl, nonce, issuedAt, expiresAt }) {
  const parsed = new URL(baseUrl);

  return `${parsed.hostname} wants you to sign in with your Ethereum account:
${walletAddress}

Sign this message to log in to AltLLM Portal.

URI: ${baseUrl}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expiresAt}`;
}

test("login-wallet external signature requests an explicit Portal token and saves it", async () => {
  await withTempDir(async (dir) => {
    const sessionFile = join(dir, "session.json");
    const server = await startPortalServer(async (request) => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/auth/crypto/verify");

      return {
        json: {
          token: "portal-session-token",
          user,
        },
      };
    });

    try {
      const result = await runCli([
        "login-wallet",
        "--base-url",
        server.baseUrl,
        "--wallet-address",
        walletAddress,
        "--nonce",
        "nonce-external",
        "--signature",
        validSignature,
        "--session-file",
        sessionFile,
      ]);

      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, true);
      assert.equal(output.sessionFile, sessionFile);
      assert.deepEqual(output.user, user);
      assert.equal(output.token, undefined);

      assert.equal(server.requests.length, 1);
      assert.equal(
        server.requests[0].headers["x-altllm-return-portal-token"],
        "1"
      );
      assert.deepEqual(server.requests[0].body, {
        wallet_address: walletAddress,
        nonce: "nonce-external",
        signature: validSignature,
      });

      const savedSession = JSON.parse(await readFile(sessionFile, "utf8"));
      assert.deepEqual(savedSession, {
        baseUrl: server.baseUrl,
        token: "portal-session-token",
        user,
      });
    } finally {
      await server.close();
    }
  });
});

test("login-wallet fails clearly and does not save a session when token is missing", async () => {
  await withTempDir(async (dir) => {
    const sessionFile = join(dir, "session.json");
    const server = await startPortalServer(async (request) => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/auth/crypto/verify");

      return {
        json: {
          user,
        },
      };
    });

    try {
      const result = await runCliExpectFailure([
        "login-wallet",
        "--base-url",
        server.baseUrl,
        "--wallet-address",
        walletAddress,
        "--nonce",
        "nonce-missing-token",
        "--signature",
        validSignature,
        "--session-file",
        sessionFile,
      ]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /did not include a session token/);
      assert.equal(
        server.requests[0].headers["x-altllm-return-portal-token"],
        "1"
      );
      await assert.rejects(access(sessionFile));
    } finally {
      await server.close();
    }
  });
});

test("login-wallet local signing verify path requests an explicit Portal token", async () => {
  await withTempDir(async (dir) => {
    const sessionFile = join(dir, "session.json");
    const nonce = "nonce-local-signing";
    const issuedAt = new Date(Date.now() - 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    let baseUrl = "";
    const server = await startPortalServer(async (request) => {
      if (request.url === "/api/auth/crypto/challenge") {
        assert.equal(request.method, "POST");
        assert.deepEqual(request.body, {
          wallet_address: walletAddress,
          chain_id: 1,
        });

        return {
          json: {
            wallet_address: walletAddress,
            chain_id: 1,
            nonce,
            message: buildChallengeMessage({
              baseUrl,
              nonce,
              issuedAt,
              expiresAt,
            }),
            expires_at: expiresAt,
          },
        };
      }

      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/auth/crypto/verify");
      assert.equal(
        request.headers["x-altllm-return-portal-token"],
        "1"
      );
      assert.equal(request.body.wallet_address, walletAddress);
      assert.equal(request.body.nonce, nonce);
      assert.match(request.body.signature, /^0x[a-fA-F0-9]{130}$/);

      return {
        json: {
          token: "portal-session-token-local",
          user,
        },
      };
    });
    baseUrl = server.baseUrl;

    try {
      const result = await runCli(
        [
          "login-wallet",
          "--base-url",
          server.baseUrl,
          "--wallet-address",
          walletAddress,
          "--session-file",
          sessionFile,
        ],
        {
          ALTLLM_WALLET_PRIVATE_KEY: walletPrivateKey,
        }
      );

      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, true);
      assert.equal(output.sessionFile, sessionFile);
      assert.equal(server.requests.length, 2);
      assert.equal(server.requests[1].url, "/api/auth/crypto/verify");

      const savedSession = JSON.parse(await readFile(sessionFile, "utf8"));
      assert.equal(savedSession.token, "portal-session-token-local");
      assert.deepEqual(savedSession.user, user);
    } finally {
      await server.close();
    }
  });
});
