import { CliError, normalizeBaseUrl } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "../lib/session.js";
import { executeDirectPayment, resolvePrivateKey } from "../lib/wallet.js";
import {
  fetchPaymentLinkStatus,
  formatPaymentLinkRecord,
  isTerminalPaymentLinkStatus,
  waitForPaymentLinkSettlement,
} from "./topup-crypto.js";

export interface PayPaymentLinkOptions {
  paymentLinkId: string;
  baseUrl?: string;
  sessionFile: string;
  privateKey?: string;
  privateKeyEnv: string;
  wait?: boolean;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
}

export async function payPaymentLink(options: PayPaymentLinkOptions): Promise<void> {
  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(options.baseUrl || session.baseUrl);
  const link = await fetchPaymentLinkStatus(baseUrl, session.token, options.paymentLinkId);

  if (isTerminalPaymentLinkStatus(link.status)) {
    throw new CliError(
      `Payment link ${options.paymentLinkId} is already in terminal status: ${link.status}.`
    );
  }

  if (!link.pay_address || !link.pay_currency || link.pay_amount === null || link.pay_amount === undefined) {
    throw new CliError(
      "Payment link does not include direct payment fields. The CLI will not downgrade to hosted checkout."
    );
  }

  const privateKey = resolvePrivateKey(options.privateKey, options.privateKeyEnv);
  const payment = await executeDirectPayment({
    privateKey,
    payAddress: link.pay_address,
    payAmount: link.pay_amount,
    payCurrency: link.pay_currency,
  });

  if (!options.wait) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ...formatPaymentLinkRecord(link),
          txHash: payment.txHash,
          chainId: payment.chainId,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const settledLink = await waitForPaymentLinkSettlement({
    baseUrl,
    token: session.token,
    paymentLinkId: options.paymentLinkId,
    pollIntervalSeconds: options.pollIntervalSeconds,
    timeoutSeconds: options.timeoutSeconds,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ...formatPaymentLinkRecord(settledLink, {
          paymentId: settledLink.payment_id ?? link.payment_id ?? null,
          paymentStatus: settledLink.payment_status ?? link.payment_status ?? null,
          payAddress: settledLink.pay_address ?? link.pay_address ?? null,
          payAmount: settledLink.pay_amount ?? link.pay_amount ?? null,
          payCurrency: settledLink.pay_currency ?? link.pay_currency ?? null,
        }),
        txHash: payment.txHash,
        chainId: payment.chainId,
      },
      null,
      2
    )}\n`
  );
}
