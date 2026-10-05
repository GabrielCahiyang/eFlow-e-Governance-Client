import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");
const env = loadEnv("production", projectRoot, "");

const browserSecretNames = ["VITE_SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SECRET_KEY", "VITE_RESEND_API_KEY"];
const configuredBrowserSecrets = browserSecretNames.filter((name) => env[name]?.trim());

if (configuredBrowserSecrets.length > 0) {
  console.error(
    `Unsafe browser environment variables are configured: ${configuredBrowserSecrets.join(", ")}`,
  );
  process.exitCode = 1;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

const privateValues = [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SECRET_KEY, env.RESEND_API_KEY, env.RESEND_WEBHOOK_SECRET, env.EFLOW_REHEARSAL_SERVICE_ROLE_KEY]
  .map((value) => value?.trim())
  .filter((value) => value && value.length >= 16);

let builtFiles;
try {
  builtFiles = await listFiles(distRoot);
} catch {
  console.error("dist is missing. Run npm run build before secret verification.");
  process.exit(1);
}

const leakedFiles = [];
for (const filePath of builtFiles) {
  const contents = await readFile(filePath);
  if (privateValues.some((value) => contents.includes(Buffer.from(value)))) {
    leakedFiles.push(filePath.slice(projectRoot.length + 1));
  }
}

if (leakedFiles.length > 0) {
  console.error(`A private server credential was found in: ${leakedFiles.join(", ")}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("Client secret verification passed.");
}
