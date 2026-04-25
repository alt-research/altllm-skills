# Shared Session And Target Notes

- This repository targets the AltLLM Portal API, not the OpenAI-compatible gateway.
- Use the saved Portal session for follow-up commands unless the user overrides `--session-file`.
- The default session file is `~/.altllm/portal-cli-session.json`.
- After the Portal session trust-domain rollout, pre-rollout saved sessions may be rejected by Portal API routes or Cloud Claw `portal-sso`; run `altllm login-wallet` again to refresh the saved session.
- Stale-session errors should not delete the local session file implicitly. Use `altllm logout` when explicit removal is desired.
- API keys created through Portal are meant for the AltLLM OpenAI-compatible gateway at `https://api.altllm.ai/v1`.
- Current wallet login still requires an EVM address and Ethereum-style signature verification on the backend.
