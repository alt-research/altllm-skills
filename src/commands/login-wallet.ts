import { CliError, normalizeBaseUrl, requestJson } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, saveSession } from "../lib/session.js";
import {
  normalizeWalletSignature,
  resolvePrivateKey,
  signChallengeMessage,
} from "../lib/wallet.js";

interface CryptoChallengeResponse {
  wallet_address: string;
  chain_id: number;
  nonce: string;
  message: string;
  expires_at: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export interface LoginWalletOptions {
  baseUrl: string;
  walletAddress: string;
  privateKey?: string;
  privateKeyFile?: string;
  privateKeyEnv: string;
  allowUnsafePrivateKeyArgv?: boolean;
  chainId: number;
  prepare?: boolean;
  nonce?: string;
  signature?: string;
  sessionFile: string;
}

interface ParsedChallengeMessage {
  domain: string;
  walletAddress: string;
  uri: URL;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

const TRUSTED_PORTAL_API_ORIGIN = "https://platform-api.altllm.ai";
const TRUSTED_PORTAL_FRONTEND_ORIGIN = "https://platform.altllm.ai";
const CHALLENGE_MESSAGE_RE =
  /^([^\n]+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})\n\nSign this message to log in to AltLLM Portal\.\n\nURI: ([^\n]+)\nVersion: ([^\n]+)\nChain ID: ([^\n]+)\nNonce: ([^\n]+)\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/;

function validateChainId(chainId: number): void {
  if (!Number.isFinite(chainId) || !Number.isInteger(chainId) || chainId <= 0) {
    throw new CliError("Chain ID must be a positive integer.");
  }
}

function normalizeWalletAddress(walletAddress: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new CliError("Wallet address must be a valid EVM address.");
  }

  return walletAddress.toLowerCase();
}

function canonicalizeOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CliError(`Invalid URL in wallet challenge flow: ${url}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const defaultPort =
    protocol === "https:" ? "443" : protocol === "http:" ? "80" : "";
  const portSuffix =
    parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : "";

  return `${protocol}//${hostname}${portSuffix}`;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function parseTimestamp(label: string, value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CliError(`${label} must be a valid ISO-8601 timestamp.`);
  }

  return date;
}

function validateChallengeResponseMetadata(params: {
  requestedWalletAddress: string;
  requestedChainId: number;
  challenge: CryptoChallengeResponse;
}): void {
  const normalizedRequestedWalletAddress = normalizeWalletAddress(
    params.requestedWalletAddress
  );
  const normalizedChallengeWalletAddress = normalizeWalletAddress(
    params.challenge.wallet_address
  );

  if (normalizedChallengeWalletAddress !== normalizedRequestedWalletAddress) {
    throw new CliError(
      `Challenge wallet address mismatch. Expected ${normalizedRequestedWalletAddress}, got ${normalizedChallengeWalletAddress}.`
    );
  }

  if (params.challenge.chain_id !== params.requestedChainId) {
    throw new CliError(
      `Challenge chain ID mismatch. Expected ${params.requestedChainId}, got ${params.challenge.chain_id}.`
    );
  }

  if (!params.challenge.nonce.trim()) {
    throw new CliError("Challenge nonce cannot be empty.");
  }

  const expiresAt = parseTimestamp(
    "Challenge expiration time",
    params.challenge.expires_at
  );
  if (expiresAt.getTime() <= Date.now()) {
    throw new CliError("Challenge is already expired.");
  }
}

function parseChallengeMessage(message: string): ParsedChallengeMessage {
  const normalizedMessage = message.replace(/\r\n/g, "\n");
  const match = normalizedMessage.match(CHALLENGE_MESSAGE_RE);
  if (!match) {
    throw new CliError(
      "Challenge message is not a valid AltLLM Portal login challenge."
    );
  }

  const [
    ,
    domain,
    walletAddress,
    uriText,
    version,
    chainIdText,
    nonce,
    issuedAt,
    expiresAt,
  ] = match;

  if (version !== "1") {
    throw new CliError(`Unsupported challenge version: ${version}.`);
  }

  const chainId = Number(chainIdText);
  validateChainId(chainId);

  let uri: URL;
  try {
    uri = new URL(uriText);
  } catch {
    throw new CliError(`Challenge URI is invalid: ${uriText}`);
  }

  return {
    domain,
    walletAddress: normalizeWalletAddress(walletAddress),
    uri,
    chainId,
    nonce,
    issuedAt,
    expiresAt,
  };
}

function validateChallengeMessageForAutoSign(params: {
  baseUrl: string;
  requestedWalletAddress: string;
  requestedChainId: number;
  challenge: CryptoChallengeResponse;
}): void {
  const apiOrigin = canonicalizeOrigin(params.baseUrl);
  const isTrustedProductionApi = apiOrigin === TRUSTED_PORTAL_API_ORIGIN;
  const apiHostname = new URL(params.baseUrl).hostname;
  const isLoopbackApi = isLoopbackHostname(apiHostname);

  if (!isTrustedProductionApi && !isLoopbackApi) {
    throw new CliError(
      `Automatic wallet challenge signing is only allowed for ${TRUSTED_PORTAL_API_ORIGIN} or loopback hosts. Re-run with --prepare to sign externally.`
    );
  }

  const parsedMessage = parseChallengeMessage(params.challenge.message);
  const normalizedRequestedWalletAddress = normalizeWalletAddress(
    params.requestedWalletAddress
  );

  if (parsedMessage.walletAddress !== normalizedRequestedWalletAddress) {
    throw new CliError(
      `Challenge message wallet mismatch. Expected ${normalizedRequestedWalletAddress}, got ${parsedMessage.walletAddress}.`
    );
  }

  if (parsedMessage.chainId !== params.requestedChainId) {
    throw new CliError(
      `Challenge message chain ID mismatch. Expected ${params.requestedChainId}, got ${parsedMessage.chainId}.`
    );
  }

  if (parsedMessage.nonce !== params.challenge.nonce) {
    throw new CliError("Challenge message nonce does not match challenge metadata.");
  }

  if (parsedMessage.expiresAt !== params.challenge.expires_at) {
    throw new CliError(
      "Challenge message expiration time does not match challenge metadata."
    );
  }

  if (parsedMessage.domain !== parsedMessage.uri.hostname) {
    throw new CliError("Challenge domain does not match challenge URI hostname.");
  }

  const issuedAt = parseTimestamp(
    "Challenge issued-at time",
    parsedMessage.issuedAt
  );
  const expiresAt = parseTimestamp(
    "Challenge expiration time",
    parsedMessage.expiresAt
  );

  if (issuedAt.getTime() >= expiresAt.getTime()) {
    throw new CliError(
      "Challenge issued-at time must be earlier than expiration time."
    );
  }

  if (isTrustedProductionApi) {
    if (canonicalizeOrigin(parsedMessage.uri.toString()) !== TRUSTED_PORTAL_FRONTEND_ORIGIN) {
      throw new CliError(
        `Challenge URI mismatch. Expected ${TRUSTED_PORTAL_FRONTEND_ORIGIN}, got ${parsedMessage.uri.origin}.`
      );
    }
  }
}

export async function loginWallet(options: LoginWalletOptions): Promise<void> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const walletAddress = options.walletAddress.trim();

  normalizeWalletAddress(walletAddress);

  if (options.signature) {
    if (!options.nonce?.trim()) {
      throw new CliError("Provide --nonce together with --signature.");
    }

    const login = await requestJson<LoginResponse>({
      method: "POST",
      url: `${baseUrl}/api/auth/crypto/verify`,
      body: {
        wallet_address: walletAddress,
        nonce: options.nonce.trim(),
        signature: normalizeWalletSignature(options.signature),
      },
    });

    await saveSession(options.sessionFile || DEFAULT_SESSION_FILE, {
      baseUrl,
      token: login.token,
      user: login.user,
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
          user: login.user,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  validateChainId(options.chainId);

  const challenge = await requestJson<CryptoChallengeResponse>({
    method: "POST",
    url: `${baseUrl}/api/auth/crypto/challenge`,
    body: {
      wallet_address: walletAddress,
      chain_id: options.chainId,
    },
  });

  validateChallengeResponseMetadata({
    requestedWalletAddress: walletAddress,
    requestedChainId: options.chainId,
    challenge,
  });

  if (options.prepare) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          awaitingSignature: true,
          walletAddress: challenge.wallet_address,
          chainId: challenge.chain_id,
          nonce: challenge.nonce,
          message: challenge.message,
          expiresAt: challenge.expires_at,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const hasLocalPrivateKey = Boolean(
    options.privateKey?.trim() ||
      options.privateKeyFile?.trim() ||
      process.env[options.privateKeyEnv]?.trim()
  );

  if (!hasLocalPrivateKey) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          awaitingSignature: true,
          walletAddress: challenge.wallet_address,
          chainId: challenge.chain_id,
          nonce: challenge.nonce,
          message: challenge.message,
          expiresAt: challenge.expires_at,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const privateKey = await resolvePrivateKey({
    explicit: options.privateKey,
    filePath: options.privateKeyFile,
    envName: options.privateKeyEnv,
    allowUnsafeArgv: options.allowUnsafePrivateKeyArgv,
  });
  validateChallengeMessageForAutoSign({
    baseUrl,
    requestedWalletAddress: walletAddress,
    requestedChainId: options.chainId,
    challenge,
  });
  const signature = await signChallengeMessage(privateKey, challenge.message);

  const login = await requestJson<LoginResponse>({
    method: "POST",
    url: `${baseUrl}/api/auth/crypto/verify`,
    body: {
      wallet_address: walletAddress,
      nonce: challenge.nonce,
      signature,
    },
  });

  await saveSession(options.sessionFile || DEFAULT_SESSION_FILE, {
    baseUrl,
    token: login.token,
    user: login.user,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
        user: login.user,
      },
      null,
      2
    )}\n`
  );
}
