#!/usr/bin/env node
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

function parseArgs(argv) {
  const options = {
    count: 4,
    outDir: ".altllm-e2e/wallets",
    prefix: "user",
    secretPrefix: "ALTLLM_E2E_USER",
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--count") {
      const count = Number(next());
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error("--count must be a positive integer");
      }
      options.count = count;
    } else if (arg === "--out-dir") {
      options.outDir = next();
    } else if (arg === "--prefix") {
      options.prefix = next();
    } else if (arg === "--secret-prefix") {
      options.secretPrefix = next();
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`Usage: node scripts/prepare-test-wallets.mjs [options]

Options:
  --count <n>              Number of wallets to generate (default: 4)
  --out-dir <path>         Output directory (default: .altllm-e2e/wallets)
  --prefix <name>          Public test-account name prefix (default: user)
  --secret-prefix <name>   Environment/GitHub secret prefix (default: ALTLLM_E2E_USER)
  --force                  Overwrite existing output files
  -h, --help               Show help

Private keys are written only under the output directory, which is gitignored.
Do not commit wallets.private.json.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function writeJson(path, payload, mode) {
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode,
  });
  await chmod(path, mode);
}

async function writeText(path, text, mode) {
  await writeFile(path, text, {
    encoding: "utf8",
    flag: "wx",
    mode,
  });
  await chmod(path, mode);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true, mode: 0o700 });
  await mkdir(resolve(outDir, "sessions"), { recursive: true, mode: 0o700 });

  const users = Array.from({ length: options.count }, (_, index) => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const number = index + 1;
    const name = `${options.prefix}${number}`;
    const privateKeyEnv = `${options.secretPrefix}_${number}_PRIVATE_KEY`;
    const sessionFile = `${outDir}/sessions/${name}.session.json`;

    return {
      name,
      address: account.address,
      privateKey,
      privateKeyEnv,
      sessionFile,
    };
  });

  const generatedAt = new Date().toISOString();
  const privatePayload = {
    generatedAt,
    warning:
      "Sensitive local test-wallet material. Do not commit, paste into issues, or print in CI logs.",
    users,
  };
  const publicPayload = {
    generatedAt,
    note:
      "Public wallet addresses and secret names only. Store private keys in local env vars or GitHub encrypted secrets, not in git.",
    users: users.map(({ privateKey, ...publicUser }) => publicUser),
  };

  const loginLines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'BASE_URL="${ALTLLM_E2E_BASE_URL:?set ALTLLM_E2E_BASE_URL to the Portal API target}"',
    'CLI="${ALTLLM_E2E_CLI:-node dist/cli.js}"',
    "",
  ];
  for (const user of users) {
    loginLines.push(
      `ALTLLM_WALLET_PRIVATE_KEY="\${${user.privateKeyEnv}:?set ${user.privateKeyEnv}}" \\`,
      '  "$CLI" login-wallet \\',
      '    --base-url "$BASE_URL" \\',
      `    --wallet-address ${shellQuote(user.address)} \\`,
      `    --session-file ${shellQuote(user.sessionFile)}`,
      ""
    );
  }

  const secretLines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'REPO="${GITHUB_REPOSITORY:-alt-research/altllm-skills}"',
    "",
    "# Export each private key in your shell first, then run this script.",
    "# Example: export ALTLLM_E2E_USER_1_PRIVATE_KEY=0x...",
    "",
  ];
  for (const user of users) {
    secretLines.push(
      `printf '%s' "\${${user.privateKeyEnv}:?set ${user.privateKeyEnv}}" | gh secret set ${user.privateKeyEnv} --repo "$REPO"`
    );
  }
  secretLines.push("");

  const privatePath = resolve(outDir, "wallets.private.json");
  const publicPath = resolve(outDir, "wallets.public.json");
  const loginPath = resolve(outDir, "login-commands.sh");
  const secretsPath = resolve(outDir, "github-secrets-template.sh");

  if (options.force) {
    await Promise.all(
      [privatePath, publicPath, loginPath, secretsPath].map((path) =>
        rm(path, { force: true })
      )
    );
  }

  await writeJson(privatePath, privatePayload, 0o600);
  await writeJson(publicPath, publicPayload, 0o644);
  await writeText(loginPath, `${loginLines.join("\n")}\n`, 0o700);
  await writeText(secretsPath, `${secretLines.join("\n")}\n`, 0o700);

  process.stdout.write(
    `${JSON.stringify(
      {
        outDir,
        publicFile: publicPath,
        privateFile: privatePath,
        loginCommands: loginPath,
        githubSecretsTemplate: secretsPath,
        users: publicPayload.users,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
});
