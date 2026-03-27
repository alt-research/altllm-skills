# AltLLM Portal Payments — CLI Reference

## Commands

### Create hosted payment link

```bash
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 25
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

## Notes

- Payment-link lookup currently paginates the Portal API listing until the target link is found.
- Automatic payment requires `pay_address`, `pay_amount`, and `pay_currency` to be present in the API response.
