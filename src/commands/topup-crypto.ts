import { CliError, normalizeBaseUrl, requestJson } from "../lib/api.js";
import {
  DEFAULT_SESSION_FILE,
  loadSession,
  resolveSessionBackedBaseUrl,
} from "../lib/session.js";
import { executeDirectPayment, resolvePrivateKey } from "../lib/wallet.js";

export interface TopupCryptoOptions {
  amount: number;
  baseUrl?: string;
  redirectUrl?: string;
  payCurrency?: string;
  autoPay?: boolean;
  privateKey?: string;
  privateKeyFile?: string;
  privateKeyEnv: string;
  allowUnsafePrivateKeyArgv?: boolean;
  sessionFile: string;
  wait?: boolean;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
  allowTokenHostMismatch?: boolean;
}

interface CreatePaymentLinkResponse {
  payment_link_id: string;
  url: string | null;
  amount: number | string;
  currency: string;
  expires_at?: string | null;
  payment_id?: string | null;
  payment_status?: string | null;
  pay_address?: string | null;
  pay_amount?: string | number | null;
  pay_currency?: string | null;
}

interface PaymentLinkRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider_status: string | null;
  settlement_amount: number | null;
  webhook_received_at?: string | null;
  created_at: string;
  payment_id?: string | null;
  payment_status?: string | null;
  pay_address?: string | null;
  pay_amount?: string | number | null;
  pay_currency?: string | null;
}

interface PaymentLinksResponse {
  payment_links: PaymentLinkRecord[];
}

const TERMINAL_STATUSES = new Set(["completed", "expired", "failed", "deactivated"]);
const PAYMENT_LINK_LOOKUP_LIMIT = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validatePaymentPollingOptions(params: {
  pollIntervalSeconds: number;
  timeoutSeconds: number;
}): void {
  if (!Number.isFinite(params.pollIntervalSeconds) || params.pollIntervalSeconds <= 0) {
    throw new CliError("Polling interval must be a positive number of seconds.");
  }

  if (!Number.isFinite(params.timeoutSeconds) || params.timeoutSeconds <= 0) {
    throw new CliError("Timeout must be a positive number of seconds.");
  }
}

export async function fetchPaymentLinkStatus(
  baseUrl: string,
  token: string,
  paymentLinkId: string
): Promise<PaymentLinkRecord> {
  const payload = await requestJson<PaymentLinksResponse>({
    method: "GET",
    url: `${baseUrl}/api/billing/payment-links?limit=${PAYMENT_LINK_LOOKUP_LIMIT}`,
    token,
  });

  const link = payload.payment_links.find((item) => item.id === paymentLinkId);
  if (link) {
    return link;
  }

  throw new CliError(
    `Payment link ${paymentLinkId} was not found in the newest ${PAYMENT_LINK_LOOKUP_LIMIT} Portal payment links. The current backend only exposes the latest payment-links list and does not support lookup by paymentLinkId or older-page pagination, so older links are not reachable from payment-status/pay-payment-link yet.`
  );
}

export function isTerminalPaymentLinkStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function formatPaymentLinkRecord(
  link: PaymentLinkRecord,
  overrides: Partial<{
    paymentId: string | null;
    paymentStatus: string | null;
    payAddress: string | null;
    payAmount: string | number | null;
    payCurrency: string | null;
  }> = {}
): Record<string, unknown> {
  return {
    paymentLinkId: link.id,
    amount: link.amount,
    currency: link.currency,
    status: link.status,
    providerStatus: link.provider_status,
    settlementAmount: link.settlement_amount,
    webhookReceivedAt: link.webhook_received_at ?? null,
    createdAt: link.created_at,
    paymentId: link.payment_id ?? null,
    paymentStatus: link.payment_status ?? null,
    payAddress: link.pay_address ?? null,
    payAmount: link.pay_amount ?? null,
    payCurrency: link.pay_currency ?? null,
    ...overrides,
  };
}

export async function waitForPaymentLinkSettlement(params: {
  baseUrl: string;
  token: string;
  paymentLinkId: string;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
}): Promise<PaymentLinkRecord> {
  validatePaymentPollingOptions({
    pollIntervalSeconds: params.pollIntervalSeconds,
    timeoutSeconds: params.timeoutSeconds,
  });

  const startedAt = Date.now();

  while (true) {
    const link = await fetchPaymentLinkStatus(
      params.baseUrl,
      params.token,
      params.paymentLinkId
    );
    if (isTerminalPaymentLinkStatus(link.status)) {
      return link;
    }

    if ((Date.now() - startedAt) / 1000 >= params.timeoutSeconds) {
      throw new CliError(
        `Timed out waiting for payment link ${params.paymentLinkId} to settle.`
      );
    }

    await sleep(params.pollIntervalSeconds * 1000);
  }
}

export interface PaymentStatusOptions {
  paymentLinkId: string;
  baseUrl?: string;
  sessionFile: string;
  wait?: boolean;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
  allowTokenHostMismatch?: boolean;
}

export async function topupCrypto(options: TopupCryptoOptions): Promise<void> {
  if (!Number.isFinite(options.amount) || options.amount < 0.5) {
    throw new CliError("Amount must be >= 0.5 USD.");
  }

  if (options.wait) {
    validatePaymentPollingOptions({
      pollIntervalSeconds: options.pollIntervalSeconds,
      timeoutSeconds: options.timeoutSeconds,
    });
  }

  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(
    resolveSessionBackedBaseUrl({
      sessionBaseUrl: session.baseUrl,
      baseUrl: options.baseUrl,
      allowTokenHostMismatch: options.allowTokenHostMismatch,
    })
  );

  const created = await requestJson<CreatePaymentLinkResponse>({
    method: "POST",
    url: `${baseUrl}/api/billing/payment-link`,
    token: session.token,
    body: {
      amount: options.amount,
      redirect_url: options.redirectUrl,
      pay_currency: options.payCurrency,
    },
  });

  const initial = {
    ok: true,
    paymentLinkId: created.payment_link_id,
    url: created.url,
    amount: created.amount,
    currency: created.currency,
    expiresAt: created.expires_at ?? null,
    paymentId: created.payment_id ?? null,
    paymentStatus: created.payment_status ?? null,
    payAddress: created.pay_address ?? null,
    payAmount: created.pay_amount ?? null,
    payCurrency: created.pay_currency ?? null,
  };

  if (options.autoPay) {
    if (!created.pay_address || !created.pay_amount || !created.pay_currency) {
      throw new CliError(
        "Automatic payment requires direct payment details. Pass --pay-currency so the API creates a direct payment instead of a hosted invoice."
      );
    }

    const privateKey = await resolvePrivateKey({
      explicit: options.privateKey,
      filePath: options.privateKeyFile,
      envName: options.privateKeyEnv,
      allowUnsafeArgv: options.allowUnsafePrivateKeyArgv,
    });
    const payment = await executeDirectPayment({
      privateKey,
      payAddress: created.pay_address,
      payAmount: created.pay_amount,
      payCurrency: created.pay_currency,
    });

    Object.assign(initial, payment);
  }

  if (!options.wait) {
    process.stdout.write(`${JSON.stringify(initial, null, 2)}\n`);
    return;
  }

  const link = await waitForPaymentLinkSettlement({
    baseUrl,
    token: session.token,
    paymentLinkId: created.payment_link_id,
    pollIntervalSeconds: options.pollIntervalSeconds,
    timeoutSeconds: options.timeoutSeconds,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ...initial,
        ...formatPaymentLinkRecord(link, {
          paymentId: link.payment_id ?? created.payment_id ?? null,
          paymentStatus: link.payment_status ?? created.payment_status ?? null,
          payAddress: link.pay_address ?? created.pay_address ?? null,
          payAmount: link.pay_amount ?? created.pay_amount ?? null,
          payCurrency: link.pay_currency ?? created.pay_currency ?? null,
        }),
      },
      null,
      2
    )}\n`
  );
}

export async function paymentStatus(options: PaymentStatusOptions): Promise<void> {
  if (options.wait) {
    validatePaymentPollingOptions({
      pollIntervalSeconds: options.pollIntervalSeconds,
      timeoutSeconds: options.timeoutSeconds,
    });
  }

  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(
    resolveSessionBackedBaseUrl({
      sessionBaseUrl: session.baseUrl,
      baseUrl: options.baseUrl,
      allowTokenHostMismatch: options.allowTokenHostMismatch,
    })
  );
  const link = options.wait
    ? await waitForPaymentLinkSettlement({
        baseUrl,
        token: session.token,
        paymentLinkId: options.paymentLinkId,
        pollIntervalSeconds: options.pollIntervalSeconds,
        timeoutSeconds: options.timeoutSeconds,
      })
    : await fetchPaymentLinkStatus(baseUrl, session.token, options.paymentLinkId);

  process.stdout.write(`${JSON.stringify(formatPaymentLinkRecord(link), null, 2)}\n`);
}
