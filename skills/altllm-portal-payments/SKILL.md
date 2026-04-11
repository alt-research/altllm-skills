---
name: altllm-portal-payments
description: Use this skill when the user asks to create a crypto payment link, poll payment status, or execute a supported direct wallet payment through the AltLLM Portal CLI. Do NOT use for wallet login, API key management, or billing history.
user-invocable: true
---

# AltLLM Portal Payments

Payment-link creation, settlement polling, and direct wallet payment flows for the local `altllm` CLI.

## Shared Setup

> Before the first `altllm` command in a fresh checkout, read and follow:
> - `../_shared/preflight.md`
> - `../_shared/session-and-target.md`

## Command Index

| Command | Purpose |
|---|---|
| `topup-crypto` | Create a hosted or direct crypto payment link |
| `payment-status` | Inspect or poll an existing payment link |
| `pay-payment-link` | Send a direct on-chain payment for an existing link |

## Guardrails

- Unsupported `pay_currency` values must fail fast.
- `pay-payment-link` must not pay terminal links (`completed`, `expired`, `failed`, `deactivated`).
- Do not silently downgrade from direct payment to hosted checkout.
- `pay-payment-link --wait` should emit one final JSON document.
- Payment-link lookup currently depends on the Portal `GET /api/billing/payment-links?limit=100` view because the backend does not expose per-link lookup or offset pagination.
- Supported direct-payment currencies are:
  - `eth`
  - `usdterc20`
  - `usdcerc20`
  - `usdcbase`
  - `usdtbase`

## Reference

See [references/cli-reference.md](references/cli-reference.md) for workflows and representative outputs.
