import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localDir = path.join(extensionDir, "local");
const localConfigPath = path.join(localDir, "config.json");
const nodeModulesPath = path.join(extensionDir, "node_modules");

async function main() {
  const existingConfig = await readExistingConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const appUrl = await ask(rl, "LearnCache app URL", existingConfig.appUrl ?? "http://127.0.0.1:3000");
    const extensionApiToken = await askSecret(rl, "Extension API token", existingConfig.extensionApiToken);
    const hostPermissions = hostPermissionsFor(appUrl, existingConfig.hostPermissions);

    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(
      localConfigPath,
      `${JSON.stringify(
        {
          appUrl,
          extensionApiToken,
          hostPermissions
        },
        null,
        2
      )}\n`
    );

    if (!(await exists(nodeModulesPath))) {
      const install = await ask(rl, "Install extension dependencies now? (Y/n)", "Y");
      if (!/^n/i.test(install)) await run("npm", ["install"]);
    }

    const build = await ask(rl, "Build extension now? (Y/n)", "Y");
    if (!/^n/i.test(build)) await run("npm", ["run", "build:local"]);

    console.log("");
    console.log("Extension setup complete.");
    console.log(`Local config: ${localConfigPath}`);
    console.log("Load this folder in chrome://extensions:");
    console.log(`  ${path.join(extensionDir, "build", "chrome-mv3-prod")}`);
    console.log("Hosted CORS should include:");
    console.log("  chrome-extension://*");
  } finally {
    rl.close();
  }
}

async function ask(rl, label, defaultValue) {
  const answer = await rl.question(`${label}${defaultValue ? ` [${defaultValue}]` : ""}: `);
  return answer.trim() || defaultValue || "";
}

async function askSecret(rl, label, existingValue) {
  const placeholder = existingValue ? "keep existing" : "required";
  const answer = await rl.question(`${label} [${placeholder}]: `);
  const value = answer.trim();
  if (value) return value;
  if (existingValue) return existingValue;
  throw new Error("Extension API token is required.");
}

function hostPermissionsFor(appUrl, existingHostPermissions) {
  const permissions = new Set(["https://www.youtube.com/*"]);
  try {
    const appOrigin = new URL(appUrl).origin.replace(/\/$/, "");
    permissions.add(`${appOrigin}/*`);
  } catch {
    permissions.add("http://127.0.0.1:3000/*");
  }

  for (const permission of existingHostPermissions ?? []) {
    if (permission.includes("youtube.com")) permissions.add(permission);
    if (permission.startsWith("http://127.0.0.1") || permission.startsWith("http://localhost")) permissions.add(permission);
  }

  return Array.from(permissions);
}

async function readExistingConfig() {
  try {
    return JSON.parse(await fs.readFile(localConfigPath, "utf8"));
  } catch {
    return {};
  }
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: extensionDir,
      shell: process.platform === "win32",
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
