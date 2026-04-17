import { CliError } from "../lib/api.js";
import { readFile } from "node:fs/promises";
import {
  parseCloudClawAgentType,
  requestCloudClawJson,
  validateDeploymentName,
  validateTelegramAllowedUsers,
  writeJson,
} from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawDeployOptions {
  name: string;
  agentType: string;
  model?: string;
  telegramBotToken?: string;
  telegramBotTokenEnv?: string;
  telegramBotTokenFile?: string;
  telegramAllowedUsers?: string;
  altllmApiKey?: string;
  altllmApiKeyEnv?: string;
  altllmApiKeyFile?: string;
  altllmApiBase?: string;
  anthropicApiKey?: string;
  anthropicApiKeyEnv?: string;
  anthropicApiKeyFile?: string;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
}

async function resolveOptionalSecret(params: {
  label: string;
  direct?: string;
  envName?: string;
  filePath?: string;
}): Promise<string | undefined> {
  const configuredSources = [
    params.direct !== undefined ? "direct" : undefined,
    params.envName !== undefined ? "env" : undefined,
    params.filePath !== undefined ? "file" : undefined,
  ].filter((value): value is string => value !== undefined);

  if (configuredSources.length > 1) {
    throw new CliError(
      `Provide ${params.label} via only one source: direct flag, --${params.label}-env, or --${params.label}-file.`
    );
  }

  if (params.direct !== undefined) {
    const trimmed = params.direct.trim();
    if (!trimmed) {
      throw new CliError(`${params.label} cannot be empty when provided.`);
    }
    return trimmed;
  }

  if (params.envName !== undefined) {
    const envName = params.envName.trim();
    if (!envName) {
      throw new CliError(`--${params.label}-env cannot be empty.`);
    }

    const value = process.env[envName]?.trim();
    if (!value) {
      throw new CliError(`Environment variable ${envName} is missing or empty.`);
    }
    return value;
  }

  if (params.filePath !== undefined) {
    const filePath = params.filePath.trim();
    if (!filePath) {
      throw new CliError(`--${params.label}-file cannot be empty.`);
    }

    const value = (await readFile(filePath, "utf8")).trim();
    if (!value) {
      throw new CliError(`Secret file is empty: ${filePath}`);
    }
    return value;
  }

  return undefined;
}

export async function cloudClawDeploy(
  options: CloudClawDeployOptions
): Promise<void> {
  const name = validateDeploymentName(options.name);
  const agentType = parseCloudClawAgentType(options.agentType);
  const telegramBotToken = await resolveOptionalSecret({
    label: "telegram-bot-token",
    direct: options.telegramBotToken,
    envName: options.telegramBotTokenEnv,
    filePath: options.telegramBotTokenFile,
  });
  const altllmApiKey = await resolveOptionalSecret({
    label: "altllm-api-key",
    direct: options.altllmApiKey,
    envName: options.altllmApiKeyEnv,
    filePath: options.altllmApiKeyFile,
  });
  const anthropicApiKey = await resolveOptionalSecret({
    label: "anthropic-api-key",
    direct: options.anthropicApiKey,
    envName: options.anthropicApiKeyEnv,
    filePath: options.anthropicApiKeyFile,
  });

  if ((agentType === "picoclaw" || agentType === "aintern") && !telegramBotToken) {
    throw new CliError("Telegram bot token is required for picoclaw and aintern deployments.");
  }

  if (agentType === "openclaw" && !options.model?.trim()) {
    throw new CliError("OpenClaw deployment requires --model.");
  }

  const env: Record<string, string> = {};
  if (agentType === "openclaw" && options.model?.trim()) {
    env.OPENCLAW_MODEL = options.model.trim();
  }
  if (telegramBotToken) {
    env.TELEGRAM_BOT_TOKEN = telegramBotToken;
  }
  const allowedUsers = validateTelegramAllowedUsers(options.telegramAllowedUsers);
  if (allowedUsers) {
    env.TELEGRAM_ALLOWED_USERS = allowedUsers;
  }
  if (altllmApiKey) {
    env.ALTLLM_API_KEY = altllmApiKey;
  }
  if (options.altllmApiBase?.trim()) {
    env.ALTLLM_API_BASE = options.altllmApiBase.trim();
  }
  if (anthropicApiKey) {
    env.ANTHROPIC_API_KEY = anthropicApiKey;
  }

  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: "/api/vm/deployments",
    body: {
      name,
      agentType,
      env,
    },
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}
