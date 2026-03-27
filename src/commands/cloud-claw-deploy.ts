import { CliError } from "../lib/api.js";
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
  telegramAllowedUsers?: string;
  altllmApiKey?: string;
  altllmApiBase?: string;
  anthropicApiKey?: string;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
}

export async function cloudClawDeploy(
  options: CloudClawDeployOptions
): Promise<void> {
  const name = validateDeploymentName(options.name);
  const agentType = parseCloudClawAgentType(options.agentType);

  if ((agentType === "picoclaw" || agentType === "aintern") && !options.telegramBotToken?.trim()) {
    throw new CliError("Telegram bot token is required for picoclaw and aintern deployments.");
  }

  if (agentType === "openclaw" && !options.model?.trim()) {
    throw new CliError("OpenClaw deployment requires --model.");
  }

  const env: Record<string, string> = {};
  if (agentType === "openclaw" && options.model?.trim()) {
    env.OPENCLAW_MODEL = options.model.trim();
  }
  if (options.telegramBotToken?.trim()) {
    env.TELEGRAM_BOT_TOKEN = options.telegramBotToken.trim();
  }
  const allowedUsers = validateTelegramAllowedUsers(options.telegramAllowedUsers);
  if (allowedUsers) {
    env.TELEGRAM_ALLOWED_USERS = allowedUsers;
  }
  if (options.altllmApiKey?.trim()) {
    env.ALTLLM_API_KEY = options.altllmApiKey.trim();
  }
  if (options.altllmApiBase?.trim()) {
    env.ALTLLM_API_BASE = options.altllmApiBase.trim();
  }
  if (options.anthropicApiKey?.trim()) {
    env.ANTHROPIC_API_KEY = options.anthropicApiKey.trim();
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
  });

  writeJson(result);
}
