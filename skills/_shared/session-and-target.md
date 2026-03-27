# Shared Session And Target Notes

- This repository targets the AltLLM Portal API, not the OpenAI-compatible gateway.
- Use the saved Portal session for follow-up commands unless the user overrides `--session-file`.
- The default session file is `~/.altllm/portal-cli-session.json`.
- API keys created through Portal are meant for the AltLLM OpenAI-compatible gateway at `https://api.altllm.ai/v1`.
- Current wallet login still requires an EVM address and Ethereum-style signature verification on the backend.
