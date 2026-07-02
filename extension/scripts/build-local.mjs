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

  packageJson.manifest = {
    ...(packageJson.manifest ?? {}),
    host_permissions: localConfig.hostPermissions
  };

  await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  try {
    await runNpmBuild({
      ...process.env,
      PLASMO_PUBLIC_APP_URL: localConfig.appUrl,
      PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY: localConfig.clerkPublishableKey
    });
    printPostBuildNotes(localConfig.appUrl);
  } finally {
    await fs.writeFile(packagePath, packageJsonRaw);
  }
}

function printPostBuildNotes(appUrl) {
  console.log("");
  console.log("LearnCache extension build complete.");
  console.log("Load extension/build/chrome-mv3-prod in chrome://extensions, then copy its extension ID.");
  console.log("Add this origin to Clerk allowed_origins and LearnCache CORS_ALLOWED_ORIGINS:");
  console.log("  chrome-extension://YOUR_EXTENSION_ID");
  console.log(`LearnCache app URL for this build: ${appUrl}`);
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
