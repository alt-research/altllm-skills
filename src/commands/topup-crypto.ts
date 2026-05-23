import { CliError, normalizeBaseUrl, requestJson } from "../lib/api.js";
import {
  DEFAULT_SESSION_FILE,
  loadSession,
  resolveSessionBackedBaseUrl,
} from "../lib/session.js";
import {
  executeDirectPayment,
  resolvePrivateKey,
  validateUnsafePrivateKeyArgvUsage,
} from "../lib/wallet.js";

export interface TopupCryptoOptions {
  amount: number;
  baseUrl?: string;
  redirectUrl?: string;
  payCurrency?: string;
  discountCode?: string;
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

type DiscountNumber = number | string | null;

interface PaymentDiscountFields {
  promo_code?: string | null;
  original_amount?: DiscountNumber;
  discount_percent?: DiscountNumber;
  discount_amount?: DiscountNumber;
  final_amount?: DiscountNumber;
  allowed_pay_currencies?: string[] | null;
}

interface CreatePaymentLinkResponse extends PaymentDiscountFields {
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

interface PaymentLinkRecord extends PaymentDiscountFields {
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

interface TopupDiscountPreviewResponse {
  code: string;
  original_amount: DiscountNumber;
  discount_percent: DiscountNumber;
  max_discount_amount?: DiscountNumber;
  discount_amount: DiscountNumber;
  final_amount: DiscountNumber;
  allowed_pay_currencies: string[];
  selected_pay_currency?: string | null;
  validation_status?: string;
  message?: string;
  payment_link_id?: string | null;
  payment_link_url?: string | null;
}

const TERMINAL_STATUSES = new Set(["completed", "expired", "failed", "deactivated"]);
const PAYMENT_LINK_LOOKUP_LIMIT = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOptionalNonEmptyOption(
  value: string | undefined,
  optionName: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliError(`${optionName} cannot be empty.`);
  }

  return trimmed;
}

function normalizeOptionalPayCurrency(value: string | undefined): string | undefined {
  return normalizeOptionalNonEmptyOption(value, "--pay-currency")?.toLowerCase();
}

function normalizeOptionalDiscountCode(value: string | undefined): string | undefined {
  return normalizeOptionalNonEmptyOption(value, "--discount-code");
}

export function normalizeAllowedPayCurrencies(
  fields: PaymentDiscountFields
): string[] {
  return Array.from(
    new Set(
      (fields.allowed_pay_currencies ?? [])
        .map((currency) => currency.trim().toLowerCase())
        .filter((currency) => currency.length > 0)
    )
  );
}

function formatCurrencyList(currencies: string[]): string {
  return currencies.join(", ");
}

export function validateDiscountPayCurrency(params: {
  discountCode?: string | null;
  payCurrency?: string | null;
  allowedPayCurrencies: string[];
}): void {
  if (!params.discountCode || params.allowedPayCurrencies.length === 0) {
    return;
  }

  const allowedPayCurrencies = params.allowedPayCurrencies.map((currency) =>
    currency.toLowerCase()
  );
  const payCurrency = params.payCurrency?.trim().toLowerCase();

  if (payCurrency) {
    if (!allowedPayCurrencies.includes(payCurrency)) {
      throw new CliError(
        `Discount code ${params.discountCode} can only be used with: ${formatCurrencyList(allowedPayCurrencies)}.`
      );
    }
    return;
  }
}

async function previewTopupDiscountCode(params: {
  baseUrl: string;
  token: string;
  amount: number;
  discountCode: string;
}): Promise<TopupDiscountPreviewResponse> {
  return requestJson<TopupDiscountPreviewResponse>({
    method: "POST",
    url: `${params.baseUrl}/api/billing/topup-promo/preview`,
    token: params.token,
    body: {
      code: params.discountCode,
      amount: params.amount,
    },
  });
}

async function resolveDiscountPayCurrency(params: {
  baseUrl: string;
  token: string;
  amount: number;
  discountCode?: string;
  payCurrency?: string;
}): Promise<string | undefined> {
  if (!params.discountCode) {
    return params.payCurrency;
  }

  const preview = await previewTopupDiscountCode({
    baseUrl: params.baseUrl,
    token: params.token,
    amount: params.amount,
    discountCode: params.discountCode,
  });
  const discountCode = preview.code || params.discountCode;
  const allowedPayCurrencies = normalizeAllowedPayCurrencies(preview);

  if (allowedPayCurrencies.length === 0) {
    throw new CliError(
      `Discount code ${discountCode} did not return allowed payment currencies. Re-run with --pay-currency after verifying the code in Portal.`
    );
  }

  if (params.payCurrency) {
    validateDiscountPayCurrency({
      discountCode,
      payCurrency: params.payCurrency,
      allowedPayCurrencies,
    });
    return params.payCurrency;
  }

  const selectedPayCurrency = preview.selected_pay_currency?.trim().toLowerCase();
  if (
    selectedPayCurrency &&
    allowedPayCurrencies.includes(selectedPayCurrency)
  ) {
    return selectedPayCurrency;
  }

  if (allowedPayCurrencies.length === 1) {
    return allowedPayCurrencies[0];
  }

  if (allowedPayCurrencies.length > 1) {
    throw new CliError(
      `Discount code ${discountCode} can be used with: ${formatCurrencyList(allowedPayCurrencies)}. Re-run with --pay-currency <ticker>.`
    );
  }

  throw new CliError(`Unable to resolve pay currency for discount code ${discountCode}.`);
}

export function formatPaymentDiscountFields(
  primary: PaymentDiscountFields,
  fallback?: PaymentDiscountFields
): {
  discountCode: string | null;
  originalAmount: DiscountNumber;
  discountPercent: DiscountNumber;
  discountAmount: DiscountNumber;
  finalAmount: DiscountNumber;
  allowedPayCurrencies: string[] | null;
} {
  return {
    discountCode: primary.promo_code ?? fallback?.promo_code ?? null,
    originalAmount: primary.original_amount ?? fallback?.original_amount ?? null,
    discountPercent: primary.discount_percent ?? fallback?.discount_percent ?? null,
    discountAmount: primary.discount_amount ?? fallback?.discount_amount ?? null,
    finalAmount: primary.final_amount ?? fallback?.final_amount ?? null,
    allowedPayCurrencies:
      primary.allowed_pay_currencies ?? fallback?.allowed_pay_currencies ?? null,
  };
}

type FormattedPaymentDiscountFields = ReturnType<typeof formatPaymentDiscountFields>;

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
  overrides: Partial<
    {
      paymentId: string | null;
      paymentStatus: string | null;
      payAddress: string | null;
      payAmount: string | number | null;
      payCurrency: string | null;
    } & FormattedPaymentDiscountFields
  > = {}
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
    ...formatPaymentDiscountFields(link),
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

  validateUnsafePrivateKeyArgvUsage({
    explicit: options.privateKey,
    allowUnsafeArgv: options.allowUnsafePrivateKeyArgv,
  });

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
  const payCurrency = normalizeOptionalPayCurrency(options.payCurrency);
  const discountCode = normalizeOptionalDiscountCode(options.discountCode);
  const resolvedPayCurrency = await resolveDiscountPayCurrency({
    baseUrl,
    token: session.token,
    amount: options.amount,
    discountCode,
    payCurrency,
  });

  const body: Record<string, unknown> = {
    amount: options.amount,
  };
  if (options.redirectUrl !== undefined) {
    body.redirect_url = options.redirectUrl;
  }
  if (resolvedPayCurrency !== undefined) {
    body.pay_currency = resolvedPayCurrency;
  }
  if (discountCode !== undefined) {
    body.promo_code = discountCode;
  }

  const created = await requestJson<CreatePaymentLinkResponse>({
    method: "POST",
    url: `${baseUrl}/api/billing/payment-link`,
    token: session.token,
    body,
  });
  const createdDiscountCode = created.promo_code ?? discountCode ?? null;
  validateDiscountPayCurrency({
    discountCode: createdDiscountCode,
    payCurrency: created.pay_currency ?? resolvedPayCurrency ?? null,
    allowedPayCurrencies: normalizeAllowedPayCurrencies(created),
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
    ...formatPaymentDiscountFields(created),
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
  validateDiscountPayCurrency({
    discountCode: link.promo_code ?? createdDiscountCode,
    payCurrency:
      link.pay_currency ?? created.pay_currency ?? resolvedPayCurrency ?? null,
    allowedPayCurrencies: normalizeAllowedPayCurrencies(link),
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
          ...formatPaymentDiscountFields(link, created),
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
