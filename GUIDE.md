# AltLLM Skill Guide

This guide is for people using the repo-local AltLLM skills through an agent.

It is not a full command reference. For command-by-command CLI documentation, examples, and option details, use [README.md](./README.md).

Use this guide when you want to know:

- what the skill can do for you end to end
- what kinds of requests you can make in plain language
- what information you should provide up front
- where the current limitations are

## What This Skill Can Do

The skill can operate the AltLLM Portal workflow for you from this repository.

Main areas:

- wallet login and local session bootstrap
- balance, transaction history, promo redemption, and usage reporting
- API key creation and listing
- crypto top-up payment link creation and direct-payment execution
- x402 Portal credit top-up guidance for BSC/USDT wallet payments
- Cloud Claw VM deployment and lifecycle operations

Typical end-to-end workflows it can complete:

- log in with a wallet, create an API key, and verify it against the AltLLM gateway
- check credit, inspect recent transactions, and explain where balance changed
- redeem a promo code and verify the new balance
- create a direct Base payment link and, if a funded wallet key is available, pay it
- create an x402 quote for BSC/USDT credits, settle it after wallet signing, and verify balance
- deploy a PicoClaw or OpenClaw VM, confirm status, stop it, and delete it

## What To Ask For

You do not need to talk in CLI syntax. Plain requests are fine.

Examples:

- "Log me in with this wallet address"
- "Check my balance and recent transactions"
- "Create an API key for altllm-basic and test it with say hi"
- "Redeem this promo code"
- "Create a Base USDC top-up link for 5 dollars"
- "Create an x402 USDT top-up quote with this discount code"
- "Settle this x402 payment payload and check my balance"
- "Deploy a PicoClaw with this Telegram bot token"
- "Stop that VM and delete it after it is terminated"

## What You Should Provide

The less the agent has to guess, the faster it can complete the workflow.

Useful inputs by task:

- wallet login:
  - wallet address
  - either a private key via `--private-key-env`, `--private-key-file`, or guarded `--private-key`, or an externally produced signature flow
- API key creation:
  - a key name
  - optional model allowlist
- promo redemption:
  - promo code
- direct crypto payment:
  - target amount in USD credit
  - chain/pay currency such as `usdcbase`
  - a funded wallet private key via `--private-key-env`, `--private-key-file`, or guarded `--private-key` if you want automatic payment
- x402:
  - Portal API origin and authenticated Portal bearer token source
  - credit amount in USD
  - network and asset, normally `bsc` and `usdt`
  - optional promo or discount code
  - wallet signing method, or a signed `payment_payload` file for settlement
- PicoClaw or Ottie deployment:
  - deployment name, or permission to generate one
  - Telegram bot token
  - Telegram allowed user IDs if you do not want the bot to be public
- OpenClaw deployment:
  - deployment name
  - model
  - Telegram bot token if Telegram access is needed

## What The Agent Will Usually Do

In a normal workflow the agent will:

- inspect the local skill docs before the first command in a domain
- prefer the local `node dist/cli.js ...` commands over ad-hoc HTTP
- use the saved Portal session when available
- keep stdout machine-readable when running the actual CLI
- verify live state after a mutation when practical

Examples of live verification:

- after creating an API key, list keys or test gateway inference
- after redeeming a promo code, re-check balance
- after deploying a VM, fetch deployment status
- after stopping or deleting a VM, confirm the new state from Cloud Claw

## What This Guide Covers Better Than README

`README.md` is the reference document.

This guide is the workflow document.

The difference:

- `README.md` tells you which commands exist and what flags they take
- `GUIDE.md` tells you what you can ask the agent to accomplish with those commands

If you are unsure which exact command to use, start here.
If you already know the command and need the exact flags, go to `README.md`.

## Current Limitations

There are a few important constraints worth knowing up front.

- single-key Portal API routes are currently broken in production:
  - `get-api-key`
  - `update-api-key`
  - `revoke-api-key`
  - list and create still work
- direct payment is only automatic when an EVM-compatible supported `pay_currency` is returned and the wallet has enough on-chain balance
- the current `altllm` CLI does not execute x402 payments; current x402 support lives in the main AltLLM Portal API
- NOWPayments top-up links are separate from AltLLM Portal x402 quote/settle flows
- Base USDC top-ups require actual `USDC` on Base, not just ETH for gas
- `topup-crypto` currently requires `--amount >= 0.5`
- payment-link lookup currently only scans the most recent `100` Portal payment links
- omitting Telegram allowed users for PicoClaw or Ottie makes the bot publicly reachable

## Safe Usage Notes

- prefer environment variables or local secret files over inline secrets when possible
- do not paste long-lived private keys unless you intend the agent to use them for that task
- treat `~/.altllm/portal-cli-session.json` as sensitive local state
- remember that newly created API keys return the full secret only once

## Good Requests To Reuse

These are good patterns for future tasks:

- "Check my current Portal balance, transactions, and usage summary"
- "Create a new API key named X for models Y and Z"
- "Create a Base payment link for N dollars and tell me the pay address"
- "Pay this payment link with the wallet key I provide and wait for settlement"
- "Create an x402 quote for $100 credits with code LAUNCH20"
- "Debug why this x402 settlement is failing with the Binance facilitator"
- "Deploy a PicoClaw with this bot token, confirm it is running, then show me the bot username"
- "Stop this VM, wait until terminated, then delete it"

## File Map

If you want to inspect the local skill layout:

- [README.md](./README.md): full CLI reference
- [skills/altllm-portal-cli/SKILL.md](./skills/altllm-portal-cli/SKILL.md): umbrella Portal skill
- [skills/altllm-portal-auth/SKILL.md](./skills/altllm-portal-auth/SKILL.md): auth flow
- [skills/altllm-portal-api-keys/SKILL.md](./skills/altllm-portal-api-keys/SKILL.md): API key flow
- [skills/altllm-portal-billing/SKILL.md](./skills/altllm-portal-billing/SKILL.md): billing and usage
- [skills/altllm-portal-payments/SKILL.md](./skills/altllm-portal-payments/SKILL.md): payment flow
- [skills/altllm-x402/SKILL.md](./skills/altllm-x402/SKILL.md): x402 Portal credit top-up guidance
- [skills/cloud-claw/SKILL.md](./skills/cloud-claw/SKILL.md): umbrella Cloud Claw skill
- [skills/cloud-claw-launch-agent/SKILL.md](./skills/cloud-claw-launch-agent/SKILL.md): VM launch flow
- [skills/cloud-claw-manage-vm/SKILL.md](./skills/cloud-claw-manage-vm/SKILL.md): VM lifecycle flow
