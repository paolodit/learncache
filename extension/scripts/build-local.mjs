import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(extensionDir, "package.json");
const localConfigPath = path.join(extensionDir, "local", "config.json");

async function main() {
  const packageJsonRaw = await fs.readFile(packagePath, "utf8");
  const packageJson = JSON.parse(packageJsonRaw);
  const localConfig = JSON.parse(await fs.readFile(localConfigPath, "utf8"));

  if (!localConfig.appUrl || !localConfig.clerkPublishableKey) {
    throw new Error("extension/local/config.json must include appUrl and clerkPublishableKey.");
  }

  if (!Array.isArray(localConfig.hostPermissions) || localConfig.hostPermissions.length === 0) {
    throw new Error("extension/local/config.json must include hostPermissions.");
  }

  if (!localConfig.clerkSyncHost) {
    throw new Error("extension/local/config.json must include clerkSyncHost. Use the Clerk Frontend API host from Clerk's Domains page, for example https://example.clerk.accounts.dev.");
  }

  const hostPermissions = unique([
    ...localConfig.hostPermissions,
    ...(localConfig.clerkSyncHost ? [hostPermissionPattern(localConfig.clerkSyncHost)] : [])
  ]);

  packageJson.manifest = {
    ...(packageJson.manifest ?? {}),
    host_permissions: hostPermissions
  };

  await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  try {
    await runNpmBuild({
      ...process.env,
      PLASMO_PUBLIC_APP_URL: localConfig.appUrl,
      PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY: localConfig.clerkPublishableKey,
      PLASMO_PUBLIC_CLERK_SYNC_HOST: localConfig.clerkSyncHost ?? ""
    });
    printPostBuildNotes(localConfig);
  } finally {
    await fs.writeFile(packagePath, packageJsonRaw);
  }
}

function hostPermissionPattern(value) {
  const url = new URL(value);
  return `${url.origin}/*`;
}

function unique(values) {
  return Array.from(new Set(values));
}

function printPostBuildNotes(localConfig) {
  console.log("");
  console.log("LearnCache extension build complete.");
  console.log("Load extension/build/chrome-mv3-prod in chrome://extensions, then copy its extension ID.");
  console.log("Add this origin to Clerk allowed_origins and LearnCache CORS_ALLOWED_ORIGINS:");
  console.log("  chrome-extension://YOUR_EXTENSION_ID");
  console.log(`LearnCache app URL for this build: ${localConfig.appUrl}`);
  console.log(`Clerk sync host for this build: ${localConfig.clerkSyncHost || "(not configured)"}`);
  console.log("");
}

function runNpmBuild(env) {
  const isWindows = process.platform === "win32";
  const npmCommand = isWindows ? "npm run build" : "npm";
  const npmArgs = isWindows ? [] : ["run", "build"];
  const childEnv = Object.fromEntries(
    Object.entries(env).filter(([key, value]) => key && !key.startsWith("=") && value !== undefined)
  );

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, npmArgs, {
      cwd: extensionDir,
      env: childEnv,
      shell: isWindows,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run build failed with exit code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
