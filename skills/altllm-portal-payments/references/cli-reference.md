# AltLLM Portal Payments — CLI Reference

## Commands

### Create hosted payment link

```bash
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 25
```

### Create discounted direct payment link

```bash
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 100 \
  --pay-currency sol \
  --discount-code SOLANA
```

### Create direct payment link and auto-pay

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 25 \
  --pay-currency usdcbase \
  --auto-pay \
  --wait
```

### Payment status

```bash
node dist/cli.js payment-status \
  --base-url https://platform-api.altllm.ai \
  --payment-link-id <id> \
  --wait
```

### Pay existing payment link

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js pay-payment-link \
  --base-url https://platform-api.altllm.ai \
  --payment-link-id <id> \
  --wait
```

Safer key input paths for payment commands:

- `--private-key-env <ENV_NAME>`
- `--private-key-file <path>`

Direct `--private-key` usage now requires `--allow-unsafe-private-key-argv`.

## Notes

- `payment-status` and `pay-payment-link` currently only search the newest `100` Portal payment links.
- Older payment links are not reachable from these CLI flows until the backend supports lookup by ID or older-page pagination.
- Automatic payment requires `pay_address`, `pay_amount`, and `pay_currency` to be present in the API response.
- `--discount-code` creates discounted credit top-up invoices only; it is separate from subscription workflows and from `redeem-promo`.
- Payment outputs include any discount fields returned by Portal, including `discountCode`, `originalAmount`, `discountPercent`, `discountAmount`, `finalAmount`, and `allowedPayCurrencies`.
- Discount-code top-ups call Portal preview before payment-link creation. If Portal returns one allowed token, the CLI uses it automatically; if multiple tokens are allowed, pass one with `--pay-currency`.
- If Portal returns `allowedPayCurrencies`, the CLI rejects mismatched `--pay-currency` values before payment-link creation.
