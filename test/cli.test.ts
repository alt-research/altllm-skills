import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", ...args],
      { cwd: process.cwd() },
      (error, stdout, stderr) => {
        if (error && !("code" in error)) {
          reject(error);
          return;
        }

        resolve({
          code:
            error && "code" in error && typeof error.code === "number"
              ? error.code
              : 0,
          stdout,
          stderr,
        });
      }
    );
  });
}

test("root help highlights aliases and common examples", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Common aliases:/);
  assert.match(result.stdout, /altllm balance\s+alias for credit/);
  assert.match(result.stdout, /altllm usage-by-key --month 2026-05/);
});

test("mistyped commands include a suggestion and help hint", async () => {
  const result = await runCli(["balnce"]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown command 'balnce'/);
  assert.match(result.stderr, /Did you mean (balance|credit)\?/);
  assert.match(result.stderr, /altllm --help/);
});

test("aliases expose command help", async () => {
  const balance = await runCli(["balance", "--help"]);
  const keys = await runCli(["keys", "--help"]);

  assert.equal(balance.code, 0);
  assert.match(balance.stdout, /Usage: altllm credit\|balance/);
  assert.equal(keys.code, 0);
  assert.match(keys.stdout, /Usage: altllm list-api-keys\|keys/);
});

test("b402 command help exposes x402 body-file workflow", async () => {
  const result = await runCli(["b402-verify", "--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: altllm b402-verify/);
  assert.match(result.stdout, /--body-file <path>/);
  assert.match(result.stdout, /B402 access token/);
});

test("topup amount parsing fails before session loading", async () => {
  const result = await runCli([
    "topup-crypto",
    "--amount",
    "abc",
    "--session-file",
    "/tmp/altllm-missing-session.json",
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--amount must be a number/);
  assert.doesNotMatch(result.stderr, /Session file not found/);
});
