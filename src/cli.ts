#!/usr/bin/env node
import { Command } from "commander";

import { credit } from "./commands/credit.js";
import { loginWallet } from "./commands/login-wallet.js";
import { DEFAULT_SESSION_FILE } from "./lib/session.js";

const program = new Command();

program
  .name("altllm")
  .description("CLI for AltLLM Portal wallet login and credit lookup");

program
  .command("login-wallet")
  .requiredOption("--wallet-address <address>", "EVM wallet address")
  .option("--base-url <url>", "Portal API base URL", process.env.ALTLLM_PORTAL_API_URL || "http://localhost:7040")
  .option("--private-key <hex>", "EVM private key")
  .option("--private-key-env <name>", "Environment variable containing the private key", "ALTLLM_WALLET_PRIVATE_KEY")
  .option("--chain-id <number>", "Chain ID for the login challenge", "1")
  .option("--session-file <path>", "Path to save the session token", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await loginWallet({
      baseUrl: options.baseUrl,
      walletAddress: options.walletAddress,
      privateKey: options.privateKey,
      privateKeyEnv: options.privateKeyEnv,
      chainId: Number(options.chainId),
      sessionFile: options.sessionFile,
    });
  });

program
  .command("credit")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await credit({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
});
