import { CliError, normalizeBaseUrl, requestJson } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, saveSession } from "../lib/session.js";
import { normalizeWalletSignature, resolvePrivateKey, signChallengeMessage } from "../lib/wallet.js";

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
  privateKeyEnv: string;
  chainId: number;
  prepare?: boolean;
  nonce?: string;
  signature?: string;
  sessionFile: string;
}

export async function loginWallet(options: LoginWalletOptions): Promise<void> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const walletAddress = options.walletAddress.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new CliError("Wallet address must be a valid EVM address.");
  }

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

  const challenge = await requestJson<CryptoChallengeResponse>({
    method: "POST",
    url: `${baseUrl}/api/auth/crypto/challenge`,
    body: {
      wallet_address: walletAddress,
      chain_id: options.chainId,
    },
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
    options.privateKey?.trim() || process.env[options.privateKeyEnv]?.trim()
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

  const privateKey = resolvePrivateKey(options.privateKey, options.privateKeyEnv);
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
