import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readCollectorTally } from "@/lib/services/collector-tally";

function loadDotEnvFile(filename: string) {
  const file = path.resolve(process.cwd(), filename);

  if (!existsSync(file)) {
    return;
  }

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvFile(".env.local");
  const tally = await readCollectorTally();
  console.log(JSON.stringify(tally, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
