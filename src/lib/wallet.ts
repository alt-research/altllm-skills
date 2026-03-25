import { privateKeyToAccount } from "viem/accounts";

import { CliError } from "./api.js";

export function resolvePrivateKey(explicit?: string, envName = "ALTLLM_WALLET_PRIVATE_KEY"): `0x${string}` {
  const candidate = (explicit ?? process.env[envName] ?? "").trim();
  if (!candidate) {
    throw new CliError(`Private key missing. Provide --private-key or set ${envName}.`);
  }

  const normalized = candidate.startsWith("0x") ? candidate : `0x${candidate}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new CliError("Private key must be a 32-byte hex string.");
  }
  return normalized as `0x${string}`;
}

export function assertWalletMatchesAddress(privateKey: `0x${string}`, walletAddress: string): void {
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new CliError(
      `Wallet/private key mismatch: provided ${walletAddress}, derived ${account.address}`
    );
  }
}

export async function signChallengeMessage(
  privateKey: `0x${string}`,
  message: string
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

