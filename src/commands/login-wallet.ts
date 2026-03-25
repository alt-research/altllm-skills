import { CliError, normalizeBaseUrl, requestJson } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, saveSession } from "../lib/session.js";
import { assertWalletMatchesAddress, resolvePrivateKey, signChallengeMessage } from "../lib/wallet.js";

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
  sessionFile: string;
}

export async function loginWallet(options: LoginWalletOptions): Promise<void> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const walletAddress = options.walletAddress.trim();
  const privateKey = resolvePrivateKey(options.privateKey, options.privateKeyEnv);

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new CliError("Wallet address must be a valid EVM address.");
  }

  assertWalletMatchesAddress(privateKey, walletAddress);

  const challenge = await requestJson<CryptoChallengeResponse>({
    method: "POST",
    url: `${baseUrl}/api/auth/crypto/challenge`,
    body: {
      wallet_address: walletAddress,
      chain_id: options.chainId,
    },
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

