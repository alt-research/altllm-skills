# AltLLM Portal CLI Reference

This skill targets the CLI code in this repository.

## Repository Files

- CLI entry:
  - [src/cli.ts](../../src/cli.ts)
- Wallet login command:
  - [src/commands/login-wallet.ts](../../src/commands/login-wallet.ts)
- Credit command:
  - [src/commands/credit.ts](../../src/commands/credit.ts)
- Session storage:
  - [src/lib/session.ts](../../src/lib/session.ts)
- HTTP client:
  - [src/lib/api.ts](../../src/lib/api.ts)
- Wallet signing:
  - [src/lib/wallet.ts](../../src/lib/wallet.ts)

## Production API Base URL

Use:

- `https://platform-api.altllm.ai`

## Install and Build

```bash
npm install
npm run build
```

## Commands

### Login with wallet

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x...
```

### Check credit

```bash
node dist/cli.js credit \
  --base-url https://platform-api.altllm.ai
```

## Session File

Default session location:

- `~/.altllm/portal-cli-session.json`

Override with:

```bash
--session-file /path/to/session.json
```

## API Endpoints Used

Wallet login:

- `POST /api/auth/crypto/challenge`
- `POST /api/auth/crypto/verify`

Credit lookup:

- `GET /api/billing/balance`

