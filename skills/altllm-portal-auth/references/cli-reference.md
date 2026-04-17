# AltLLM Portal Auth — CLI Reference

## Commands

### Local-signing login

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x...
```

Representative stdout:

```json
{
  "ok": true,
  "sessionFile": "/Users/<user>/.altllm/portal-cli-session.json",
  "user": {
    "id": "user_123",
    "email": "0x...@wallet.altllm.local",
    "name": "0x1234...abcd"
  }
}
```

### Prepare challenge for external signing

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --prepare
```

Representative stdout:

```json
{
  "ok": true,
  "awaitingSignature": true,
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "chainId": 1,
  "nonce": "challenge_nonce",
  "message": "platform.altllm.ai wants you to sign in with your Ethereum account:\n0x1111111111111111111111111111111111111111\n\nSign this message to log in to AltLLM Portal.\n\nURI: https://platform.altllm.ai\nVersion: 1\nChain ID: 1\nNonce: challenge_nonce\nIssued At: 2026-03-26T00:00:00Z\nExpiration Time: 2026-03-26T00:05:00Z",
  "expiresAt": "2026-03-26T00:05:00Z"
}
```

This flow is intended for wallets or wallet providers that sign externally, such as Privy.

### Verify externally signed challenge

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --nonce <nonce> \
  --signature <hex-signature>
```

## Notes

- If no local private key and no signature are provided, `login-wallet` returns a challenge payload.
- External signers such as Privy work if they can sign the returned challenge message for the supplied wallet address.
- Local auto-signing validates the returned challenge before signing it.
- For non-default, non-loopback API hosts, use `--prepare` and sign externally.
- The current backend rejects non-EVM address formats.
- Signature validation is Ethereum-style message recovery on the server.

### Logout local session

```bash
node dist/cli.js logout
```

Representative stdout:

```json
{
  "ok": true,
  "loggedOut": true,
  "sessionFile": "/Users/<user>/.altllm/portal-cli-session.json",
  "user": {
    "id": "user_123",
    "email": "0x...@wallet.altllm.local",
    "name": "0x1234...abcd"
  },
  "baseUrl": "https://platform-api.altllm.ai",
  "message": "Local Portal session removed."
}
```
