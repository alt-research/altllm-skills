---
name: altllm-portal-cli
description: Use this umbrella skill when the request spans multiple AltLLM Portal CLI domains, or when you need to navigate the local altllm CLI in this repository across auth, API keys, billing history, and payments.
user-invocable: true
---

# AltLLM Portal CLI

Use this umbrella skill when working inside this repository and the task crosses multiple Portal domains. For focused requests, prefer one of the domain skills below.

## Shared Setup

> Before the first `altllm` command in a fresh checkout, read and follow:
> - `../_shared/preflight.md`
> - `../_shared/session-and-target.md`

## Skill Map

| Skill | Purpose | Use When |
|---|---|---|
| `altllm-portal-auth` | Wallet login and session bootstrap | Wallet challenge, signature verification, login troubleshooting |
| `altllm-portal-api-keys` | Portal API key lifecycle | Create, inspect, disable, re-enable, or revoke API keys |
| `altllm-portal-billing` | Balance, promo, transactions, and usage analytics | Credit balance, promo redemption, billing history, usage views |
| `altllm-portal-payments` | Payment-link creation, polling, and direct payment execution | Crypto top-up, payment status, direct wallet payment |

## Working Rules

- Prefer the focused skill when the request stays within one domain.
- Use this umbrella skill when the workflow spans multiple domains, for example:
  - login -> create API key -> verify gateway use
  - credit -> transactions -> usage analytics
  - top-up -> payment-status -> pay-payment-link
- Keep implementation and docs aligned when behavior changes.

## Reference

See [references/skill-map.md](references/skill-map.md) for file ownership and command-to-skill mapping.
