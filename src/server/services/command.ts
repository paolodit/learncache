import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(command: string, args: string[], options: { cwd?: string; maxBuffer?: number } = {}): Promise<CommandResult> {
  const resolvedCommand = resolveCommand(command);
  try {
    const result = await execFileAsync(resolvedCommand, args, {
      cwd: options.cwd,
      maxBuffer: options.maxBuffer ?? 1024 * 1024 * 20,
      windowsHide: true
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const details = commandErrorMessage(error);
    throw new Error(`${command} failed: ${details}`);
  }
}

export async function assertCommand(command: string, args: string[], installHint: string): Promise<void> {
  try {
    await runCommand(command, args, { maxBuffer: 1024 * 1024 });
  } catch {
    throw new Error(`${command} is not available. ${installHint}`);
  }
}

export function resolveCommand(command: string): string {
  for (const candidate of localToolCandidates(command)) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return command;
}

function localToolCandidates(command: string): string[] {
  const toolsDir = path.resolve(process.cwd(), "tools", "bin");
  const isWindows = process.platform === "win32";

  if (command === "yt-dlp") {
    return [path.join(toolsDir, isWindows ? "yt-dlp.exe" : "yt-dlp")];
  }

  if (command === "ffmpeg") {
    return [path.join(toolsDir, isWindows ? "ffmpeg.exe" : "ffmpeg")];
  }

  return [];
}

function commandErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybe = error as { message?: string; stderr?: string; stdout?: string };
    return [maybe.stderr, maybe.stdout, maybe.message].filter(Boolean).join("\n").trim();
  }

  return String(error);
}
