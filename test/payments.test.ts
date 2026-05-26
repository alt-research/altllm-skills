import assert from "node:assert/strict";
import test from "node:test";

import { CliError } from "../src/lib/api.js";
import {
  formatPaymentDiscountFields,
  isTerminalPaymentLinkStatus,
  normalizeAllowedPayCurrencies,
  validateDiscountPayCurrency,
} from "../src/commands/topup-crypto.js";

function assertCliError(fn: () => void, message: string): void {
  assert.throws(
    fn,
    (error) => error instanceof CliError && error.message === message
  );
}

test("normalizeAllowedPayCurrencies trims, lowercases, and dedupes", () => {
  assert.deepEqual(
    normalizeAllowedPayCurrencies({
      allowed_pay_currencies: [" USDCBASE ", "usdcbase", "", "eth"],
    }),
    ["usdcbase", "eth"]
  );
});

test("validateDiscountPayCurrency rejects token-scoped mismatches", () => {
  validateDiscountPayCurrency({
    discountCode: "BASEONLY",
    payCurrency: "USDCBASE",
    allowedPayCurrencies: ["usdcbase"],
  });
  assertCliError(
    () =>
      validateDiscountPayCurrency({
        discountCode: "BASEONLY",
        payCurrency: "sol",
        allowedPayCurrencies: ["usdcbase", "eth"],
      }),
    "Discount code BASEONLY can only be used with: usdcbase, eth."
  );
});

test("formatPaymentDiscountFields prefers primary response values", () => {
  assert.deepEqual(
    formatPaymentDiscountFields(
      {
        promo_code: null,
        discount_amount: "4",
        final_amount: "21",
      },
      {
        promo_code: "SAVE",
        original_amount: "25",
        discount_percent: "16",
        discount_amount: "3",
        final_amount: "22",
        allowed_pay_currencies: ["usdcbase"],
      }
    ),
    {
      discountCode: "SAVE",
      originalAmount: "25",
      discountPercent: "16",
      discountAmount: "4",
      finalAmount: "21",
      allowedPayCurrencies: ["usdcbase"],
    }
  );
});

test("isTerminalPaymentLinkStatus handles provider casing and whitespace", () => {
  assert.equal(isTerminalPaymentLinkStatus(" completed "), true);
  assert.equal(isTerminalPaymentLinkStatus("FAILED"), true);
  assert.equal(isTerminalPaymentLinkStatus("pending"), false);
});
