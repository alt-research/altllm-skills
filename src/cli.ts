#!/usr/bin/env node
import { Command } from "commander";

import { createApiKey } from "./commands/create-api-key.js";
import { cloudClawDeployment } from "./commands/cloud-claw-deployment.js";
import { cloudClawDeploy } from "./commands/cloud-claw-deploy.js";
import { cloudClawDeployments } from "./commands/cloud-claw-deployments.js";
import {
  cloudClawAutoRenew,
  cloudClawDelete,
  cloudClawRenew,
  cloudClawRestart,
  cloudClawStart,
  cloudClawStop,
} from "./commands/cloud-claw-lifecycle.js";
import { cloudClawLogs } from "./commands/cloud-claw-logs.js";
import { cloudClawMe } from "./commands/cloud-claw-me.js";
import { credit } from "./commands/credit.js";
import { getApiKey } from "./commands/get-api-key.js";
import { listApiKeys } from "./commands/list-api-keys.js";
import { loginWallet } from "./commands/login-wallet.js";
import { logout } from "./commands/logout.js";
import { payPaymentLink } from "./commands/pay-payment-link.js";
import { redeemPromo } from "./commands/redeem-promo.js";
import { revokeApiKey } from "./commands/revoke-api-key.js";
import { paymentStatus, topupCrypto } from "./commands/topup-crypto.js";
import { updateApiKey } from "./commands/update-api-key.js";
import { transactions } from "./commands/transactions.js";
import { usageByKey } from "./commands/usage-by-key.js";
import { usageByModel } from "./commands/usage-by-model.js";
import { usageSummary } from "./commands/usage-summary.js";
import { usageTimeline } from "./commands/usage-timeline.js";
import { DEFAULT_SESSION_FILE } from "./lib/session.js";

const program = new Command();
const DEFAULT_CLOUD_CLAW_BASE_URL =
  process.env.CLOUD_CLAW_BASE_URL || "https://claw.altllm.ai";

function collectOptionValues(value: string, previous?: string[]): string[] {
  return [...(previous ?? []), value];
}

program
  .name("altllm")
  .description("CLI for AltLLM Portal auth, API key management, billing, and payments");

program
  .command("login-wallet")
  .requiredOption("--wallet-address <address>", "EVM wallet address")
  .option(
    "--base-url <url>",
    "Portal API base URL",
    process.env.ALTLLM_PORTAL_API_URL || "https://platform-api.altllm.ai"
  )
  .option("--private-key <hex>", "EVM private key for local signing")
  .option("--private-key-env <name>", "Environment variable containing the private key for local signing", "ALTLLM_WALLET_PRIVATE_KEY")
  .option("--chain-id <number>", "Chain ID for the login challenge", "1")
  .option("--prepare", "Fetch a wallet challenge for an external signer such as Privy", false)
  .option("--nonce <value>", "Existing challenge nonce for external-signature login")
  .option("--signature <hex>", "Wallet signature produced externally, for example by Privy")
  .option("--session-file <path>", "Path to save the session token", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await loginWallet({
      baseUrl: options.baseUrl,
      walletAddress: options.walletAddress,
      privateKey: options.privateKey,
      privateKeyEnv: options.privateKeyEnv,
      chainId: Number(options.chainId),
      prepare: Boolean(options.prepare),
      nonce: options.nonce,
      signature: options.signature,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("logout")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await logout({
      sessionFile: options.sessionFile,
    });
  });

program
  .command("cloud-claw-me")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawMe({
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-deployments")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .option("--include-all", "List all deployments in admin mode", false)
  .option("--include-user-info", "Include user info when listing all deployments", false)
  .action(async (options) => {
    await cloudClawDeployments({
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
      includeAll: Boolean(options.includeAll),
      includeUserInfo: Boolean(options.includeUserInfo),
    });
  });

program
  .command("cloud-claw-deployment")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawDeployment({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-deploy")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .requiredOption("--agent-type <type>", "Agent type: openclaw, picoclaw, or aintern")
  .option("--model <model>", "OpenClaw model, for example altllm/altllm-standard")
  .option("--telegram-bot-token <token>", "Telegram bot token for PicoClaw or Ottie")
  .option("--telegram-allowed-users <ids>", "Comma-separated numeric Telegram user IDs")
  .option("--altllm-api-key <key>", "Optional explicit AltLLM API key override")
  .option("--altllm-api-base <url>", "Optional explicit AltLLM API base override")
  .option("--anthropic-api-key <key>", "Optional Anthropic API key override")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawDeploy({
      name: options.name,
      agentType: options.agentType,
      model: options.model,
      telegramBotToken: options.telegramBotToken,
      telegramAllowedUsers: options.telegramAllowedUsers,
      altllmApiKey: options.altllmApiKey,
      altllmApiBase: options.altllmApiBase,
      anthropicApiKey: options.anthropicApiKey,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-start")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawStart({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-stop")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawStop({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-restart")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawRestart({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-renew")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawRenew({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-auto-renew")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .requiredOption("--enabled <bool>", "Whether auto-renew should be enabled: true or false")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawAutoRenew({
      name: options.name,
      enabled: String(options.enabled).toLowerCase() === "true",
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-delete")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .action(async (options) => {
    await cloudClawDelete({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
    });
  });

program
  .command("cloud-claw-logs")
  .requiredOption("--name <name>", "Cloud Claw deployment short name")
  .option("--cloud-claw-base-url <url>", "Cloud Claw base URL", DEFAULT_CLOUD_CLAW_BASE_URL)
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--force-sso", "Force Cloud Claw to refresh portal-sso linkage", false)
  .option("--stream", "Stream logs via SSE", false)
  .action(async (options) => {
    await cloudClawLogs({
      name: options.name,
      baseUrl: options.cloudClawBaseUrl,
      sessionFile: options.sessionFile,
      forceSso: Boolean(options.forceSso),
      stream: Boolean(options.stream),
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

program
  .command("transactions")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--page <number>", "Page number (1-indexed)")
  .option("--limit <number>", "Items per page (1-100)")
  .option("--type <type>", "Transaction type filter: all, credit, usage, or refund")
  .action(async (options) => {
    await transactions({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      page: options.page === undefined ? undefined : Number(options.page),
      limit: options.limit === undefined ? undefined : Number(options.limit),
      type: options.type,
    });
  });

program
  .command("usage-summary")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await usageSummary({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("usage-timeline")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--month <yyyy-mm>", "Month filter in YYYY-MM format")
  .option("--start-date <yyyy-mm-dd>", "Start date in YYYY-MM-DD format")
  .option("--end-date <yyyy-mm-dd>", "End date in YYYY-MM-DD format")
  .action(async (options) => {
    await usageTimeline({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      month: options.month,
      startDate: options.startDate,
      endDate: options.endDate,
    });
  });

program
  .command("usage-by-model")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--month <yyyy-mm>", "Month filter in YYYY-MM format")
  .option("--start-date <yyyy-mm-dd>", "Start date in YYYY-MM-DD format")
  .option("--end-date <yyyy-mm-dd>", "End date in YYYY-MM-DD format")
  .action(async (options) => {
    await usageByModel({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      month: options.month,
      startDate: options.startDate,
      endDate: options.endDate,
    });
  });

program
  .command("usage-by-key")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--start-date <yyyy-mm-dd>", "Start date in YYYY-MM-DD format")
  .option("--end-date <yyyy-mm-dd>", "End date in YYYY-MM-DD format")
  .action(async (options) => {
    await usageByKey({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      startDate: options.startDate,
      endDate: options.endDate,
    });
  });

program
  .command("list-api-keys")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await listApiKeys({
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("create-api-key")
  .requiredOption("--name <name>", "Human-readable API key name")
  .option("--model <id>", "Allowed model ID (repeatable)", collectOptionValues)
  .option("--models <ids>", "Comma-separated allowed model IDs")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await createApiKey({
      name: options.name,
      model: options.model,
      models: options.models,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("get-api-key")
  .requiredOption("--key-id <id>", "API key ID")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await getApiKey({
      keyId: options.keyId,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("update-api-key")
  .requiredOption("--key-id <id>", "API key ID")
  .option("--name <name>", "New API key name")
  .option("--status <status>", "API key status: active, disabled, or revoked")
  .option("--model <id>", "Allowed model ID (repeatable)", collectOptionValues)
  .option("--models <ids>", "Comma-separated allowed model IDs")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await updateApiKey({
      keyId: options.keyId,
      name: options.name,
      status: options.status,
      model: options.model,
      models: options.models,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("revoke-api-key")
  .requiredOption("--key-id <id>", "API key ID")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await revokeApiKey({
      keyId: options.keyId,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("redeem-promo")
  .requiredOption("--code <code>", "Promo code to redeem")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .action(async (options) => {
    await redeemPromo({
      code: options.code,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
    });
  });

program
  .command("topup-crypto")
  .requiredOption("--amount <usd>", "Credit amount in USD")
  .option("--base-url <url>", "Portal API base URL")
  .option("--pay-currency <ticker>", "NOWPayments pay_currency for direct payment mode")
  .option("--auto-pay", "Automatically send the on-chain payment from the local wallet", false)
  .option("--private-key <hex>", "EVM private key for automatic payment")
  .option("--private-key-env <name>", "Environment variable containing the private key", "ALTLLM_WALLET_PRIVATE_KEY")
  .option("--redirect-url <url>", "Optional redirect URL after payment")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--wait", "Poll until the payment reaches a terminal state", false)
  .option("--poll-interval <seconds>", "Polling interval in seconds", "10")
  .option("--timeout <seconds>", "Maximum wait time in seconds", "600")
  .action(async (options) => {
    await topupCrypto({
      amount: Number(options.amount),
      baseUrl: options.baseUrl,
      payCurrency: options.payCurrency,
      autoPay: Boolean(options.autoPay),
      privateKey: options.privateKey,
      privateKeyEnv: options.privateKeyEnv,
      redirectUrl: options.redirectUrl,
      sessionFile: options.sessionFile,
      wait: Boolean(options.wait),
      pollIntervalSeconds: Number(options.pollInterval),
      timeoutSeconds: Number(options.timeout),
    });
  });

program
  .command("payment-status")
  .requiredOption("--payment-link-id <id>", "Payment link ID")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--wait", "Poll until the payment reaches a terminal state", false)
  .option("--poll-interval <seconds>", "Polling interval in seconds", "10")
  .option("--timeout <seconds>", "Maximum wait time in seconds", "600")
  .action(async (options) => {
    await paymentStatus({
      paymentLinkId: options.paymentLinkId,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      wait: Boolean(options.wait),
      pollIntervalSeconds: Number(options.pollInterval),
      timeoutSeconds: Number(options.timeout),
    });
  });

program
  .command("pay-payment-link")
  .requiredOption("--payment-link-id <id>", "Payment link ID")
  .option("--base-url <url>", "Portal API base URL")
  .option("--session-file <path>", "Path to the saved Portal session", DEFAULT_SESSION_FILE)
  .option("--private-key <hex>", "EVM private key for automatic payment")
  .option("--private-key-env <name>", "Environment variable containing the private key", "ALTLLM_WALLET_PRIVATE_KEY")
  .option("--wait", "Poll until the payment reaches a terminal state after broadcast", false)
  .option("--poll-interval <seconds>", "Polling interval in seconds", "10")
  .option("--timeout <seconds>", "Maximum wait time in seconds", "600")
  .action(async (options) => {
    await payPaymentLink({
      paymentLinkId: options.paymentLinkId,
      baseUrl: options.baseUrl,
      sessionFile: options.sessionFile,
      privateKey: options.privateKey,
      privateKeyEnv: options.privateKeyEnv,
      wait: Boolean(options.wait),
      pollIntervalSeconds: Number(options.pollInterval),
      timeoutSeconds: Number(options.timeout),
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
});
