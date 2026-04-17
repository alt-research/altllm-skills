# AltLLM Portal Billing — CLI Reference

## Commands

### Balance

```bash
node dist/cli.js credit \
  --base-url https://platform-api.altllm.ai
```

### Redeem promo

```bash
node dist/cli.js redeem-promo \
  --base-url https://platform-api.altllm.ai \
  --code PROMO-XXXX
```

### Transactions

```bash
node dist/cli.js transactions \
  --base-url https://platform-api.altllm.ai \
  --limit 20 \
  --type usage
```

Representative stdout:

```json
{
  "transactions": [],
  "total": 0,
  "page": 1,
  "pages": 1,
  "limit": 20
}
```

### Usage summary

```bash
node dist/cli.js usage-summary \
  --base-url https://platform-api.altllm.ai
```

This endpoint currently returns the current calendar-month summary.

### Usage timeline

```bash
node dist/cli.js usage-timeline \
  --base-url https://platform-api.altllm.ai \
  --month 2026-03
```

### Usage by model

```bash
node dist/cli.js usage-by-model \
  --base-url https://platform-api.altllm.ai \
  --month 2026-03
```

### Usage by key

```bash
node dist/cli.js usage-by-key \
  --base-url https://platform-api.altllm.ai \
  --start-date 2026-03-01 \
  --end-date 2026-03-31
```

## Notes

- `credit` and `redeem-promo` pass through the API response body unchanged.
- Transaction history and usage analytics are useful for validating gateway metering behavior.
- `usage-timeline` and `usage-by-model` accept either `--month` or a complete `--start-date` / `--end-date` range, but not both.
- `usage-by-key` requires both `--start-date` and `--end-date`.
