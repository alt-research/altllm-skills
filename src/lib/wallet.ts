import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { base, mainnet } from "viem/chains";
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

export function normalizeWalletSignature(signature: string): `0x${string}` {
  const candidate = signature.trim();
  if (!candidate) {
    throw new CliError("Wallet signature cannot be empty.");
  }

  const normalized = candidate.startsWith("0x") ? candidate : `0x${candidate}`;
  if (!/^0x[a-fA-F0-9]{128,130}$/.test(normalized)) {
    throw new CliError("Wallet signature must be a 64-byte or 65-byte hex string.");
  }

  return normalized as `0x${string}`;
}

export async function signChallengeMessage(
  privateKey: `0x${string}`,
  message: string
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

type PaymentConfig =
  | { kind: "native"; chain: typeof mainnet | typeof base; symbol: string; decimals: number }
  | {
      kind: "erc20";
      chain: typeof mainnet | typeof base;
      tokenAddress: Address;
      symbol: string;
      decimals: number;
    };

const PAYMENT_CONFIGS: Record<string, PaymentConfig> = {
  eth: { kind: "native", chain: mainnet, symbol: "ETH", decimals: 18 },
  usdterc20: {
    kind: "erc20",
    chain: mainnet,
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    decimals: 6,
  },
  usdcerc20: {
    kind: "erc20",
    chain: mainnet,
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
  },
  usdcbase: {
    kind: "erc20",
    chain: base,
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  },
  usdtbase: {
    kind: "erc20",
    chain: base,
    tokenAddress: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    decimals: 6,
  },
};

export interface PaymentExecutionResult {
  txHash: Hex;
  chainId: number;
  payCurrency: string;
  payAddress: Address;
  payAmount: string;
}

export async function executeDirectPayment(params: {
  privateKey: `0x${string}`;
  payAddress: string;
  payAmount: string | number;
  payCurrency: string;
}): Promise<PaymentExecutionResult> {
  const config = PAYMENT_CONFIGS[params.payCurrency.toLowerCase()];
  if (!config) {
    throw new CliError(
      `Unsupported pay_currency for automatic payment: ${params.payCurrency}.`
    );
  }

  if (!isAddress(params.payAddress)) {
    throw new CliError(`Invalid pay_address returned by API: ${params.payAddress}`);
  }

  const account = privateKeyToAccount(params.privateKey);
  const transport = http(config.chain.rpcUrls.default.http[0]);
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport,
  });
  const publicClient = createPublicClient({
    chain: config.chain,
    transport,
  });

  let txHash: Hex;
  if (config.kind === "native") {
    txHash = await walletClient.sendTransaction({
      account,
      chain: config.chain,
      to: params.payAddress as Address,
      value: parseEther(String(params.payAmount)),
    });
  } else {
    txHash = await walletClient.writeContract({
      account,
      chain: config.chain,
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [
        params.payAddress as Address,
        parseUnits(String(params.payAmount), config.decimals),
      ],
    });
  }

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    chainId: config.chain.id,
    payCurrency: params.payCurrency,
    payAddress: params.payAddress as Address,
    payAmount: String(params.payAmount),
  };
}
