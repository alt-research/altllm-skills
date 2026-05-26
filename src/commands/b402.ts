import { createPrivateKey, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  CliError,
  fetchWithTimeout,
  requireSecureNonLocalBaseUrl,
} from "../lib/api.js";

export type B402Endpoint = "supported" | "verify" | "settle";

export interface B402Options {
  baseUrl?: string;
  clientId?: string;
  clientIdEnv?: string;
  accessTokenEnv?: string;
  accessTokenFile?: string;
  privateKeyEnv?: string;
  privateKeyFile?: string;
  bodyFile?: string;
}

const ENDPOINT_PATHS: Record<B402Endpoint, string> = {
  supported: "/papi/v2/b402/supported",
  verify: "/papi/v2/b402/verify",
  settle: "/papi/v2/b402/settle",
};

async function resolveSecret(params: {
  label: string;
  envName?: string;
  filePath?: string;
}): Promise<string> {
  if (params.filePath !== undefined) {
    return readSecretFile(params.label, params.filePath);
  }

  const envName = params.envName?.trim();
  if (!envName) {
    throw new CliError(
      `${params.label} environment variable name cannot be empty.`
    );
  }

  const value = process.env[envName]?.trim();
  if (!value) {
    throw new CliError(
      `${params.label} missing. Set ${envName} or provide --${params.label}-file.`
    );
  }
  return value;
}

async function readSecretFile(label: string, filePath: string): Promise<string> {
  const trimmedPath = filePath.trim();
  if (!trimmedPath) {
    throw new CliError(`--${label}-file cannot be empty.`);
  }

  const value = (await readFile(trimmedPath, "utf8")).trim();
  if (!value) {
    throw new CliError(`${label} file is empty: ${trimmedPath}`);
  }
  return value;
}

function resolveClientId(options: B402Options): string {
  if (options.clientId?.trim()) {
    return options.clientId.trim();
  }

  const envName = options.clientIdEnv?.trim() || "B402_CLIENT_ID";
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new CliError(`client-id missing. Pass --client-id or set ${envName}.`);
  }
  return value;
}

function resolveBaseUrl(baseUrl?: string): string {
  const value = baseUrl?.trim() || process.env.B402_BASE_URL?.trim();
  if (!value) {
    throw new CliError(
      "B402 base URL missing. Pass --base-url or set B402_BASE_URL."
    );
  }
  return requireSecureNonLocalBaseUrl(value, "B402 merchant credentials");
}

async function requestBody(
  endpoint: B402Endpoint,
  bodyFile?: string
): Promise<string> {
  if (!bodyFile) {
    if (endpoint === "supported") {
      return "{}";
    }
    throw new CliError(`--body-file is required for b402-${endpoint}.`);
  }

  const body = (await readFile(bodyFile, "utf8")).trim();
  if (!body) {
    throw new CliError(`Body file is empty: ${bodyFile}`);
  }
  validateJsonBody(body, bodyFile);
  return body;
}

function validateJsonBody(body: string, bodyFile: string): void {
  try {
    JSON.parse(body);
  } catch {
    throw new CliError(`Body file must contain valid JSON: ${bodyFile}`);
  }
}

export function signB402Payload(params: {
  body: string;
  timestamp: string;
  privateKey: string;
}): string {
  const signer = createSign("RSA-SHA256");
  signer.update(params.body + params.timestamp, "utf8");
  signer.end();
  return signer.sign(parseMerchantPrivateKey(params.privateKey), "base64");
}

function parseMerchantPrivateKey(
  privateKey: string
): ReturnType<typeof createPrivateKey> {
  const trimmed = privateKey.trim();
  if (trimmed.includes("BEGIN")) {
    return createPrivateKey(trimmed);
  }

  return createPrivateKey({
    key: Buffer.from(trimmed, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function b402Headers(params: {
  clientId: string;
  accessToken: string;
  body: string;
  privateKey: string;
}): Record<string, string> {
  const timestamp = String(Date.now());
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Tesla-ClientId": params.clientId,
    "X-Tesla-SignAccessToken": params.accessToken,
    "X-Tesla-Timestamp": timestamp,
    "X-Tesla-Signature": signB402Payload({
      body: params.body,
      timestamp,
      privateKey: params.privateKey,
    }),
  };
}

export async function requestB402(
  endpoint: B402Endpoint,
  options: B402Options
): Promise<unknown> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const clientId = resolveClientId(options);
  const body = await requestBody(endpoint, options.bodyFile);
  const accessToken = await resolveSecret({
    label: "access-token",
    envName: options.accessTokenEnv || "B402_ACCESS_TOKEN",
    filePath: options.accessTokenFile,
  });
  const privateKey = await resolveSecret({
    label: "private-key",
    envName: options.privateKeyEnv || "B402_PRIVATE_KEY_B64",
    filePath: options.privateKeyFile,
  });

  const response = await fetchWithTimeout({
    method: "POST",
    url: `${baseUrl}${ENDPOINT_PATHS[endpoint]}`,
    headers: b402Headers({ clientId, accessToken, body, privateKey }),
    body,
  });

  return parseB402Response(endpoint, response);
}

async function parseB402Response(
  endpoint: B402Endpoint,
  response: Response
): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new CliError(`b402-${endpoint} failed: ${response.status} ${text}`);
  }
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CliError(`b402-${endpoint} returned invalid JSON: ${text}`);
  }
}

export async function b402Command(
  endpoint: B402Endpoint,
  options: B402Options
): Promise<void> {
  const result = await requestB402(endpoint, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
