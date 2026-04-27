import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const appEntry = path.join(projectRoot, "src", "app", "app.py");

const interpreterCandidates = process.platform === "win32"
  ? [
      path.join(projectRoot, ".venv", "Scripts", "python.exe"),
      "py",
      "python",
      "python3",
    ]
  : [
      path.join(projectRoot, ".venv", "bin", "python"),
      "python3",
      "python",
    ];

async function fileExists(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveInterpreter() {
  for (const candidate of interpreterCandidates) {
    if (path.isAbsolute(candidate)) {
      if (await fileExists(candidate)) {
        return { command: candidate, args: [appEntry] };
      }
      continue;
    }

    if (candidate === "py") {
      return { command: candidate, args: ["-3", appEntry] };
    }

    return { command: candidate, args: [appEntry] };
  }

  throw new Error("Python interpreter not found.");
}

try {
  const { command, args } = await resolveInterpreter();
  const child = spawn(command, args, { stdio: "inherit" });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on("error", async () => {
    const failedCommand = command;
    const remainingCandidates = interpreterCandidates.filter((candidate) => candidate !== failedCommand);

    for (const candidate of remainingCandidates) {
      try {
        let nextCommand = candidate;
        let nextArgs = [appEntry];

        if (path.isAbsolute(candidate)) {
          if (!(await fileExists(candidate))) {
            continue;
          }
        } else if (candidate === "py") {
          nextArgs = ["-3", appEntry];
        }

        const fallbackChild = spawn(nextCommand, nextArgs, { stdio: "inherit" });
        fallbackChild.on("exit", (code, signal) => {
          if (signal) {
            process.kill(process.pid, signal);
            return;
          }
          process.exit(code ?? 1);
        });
        fallbackChild.on("error", () => {
          // Try the next interpreter candidate.
        });
        return;
      } catch {
        // Try the next interpreter candidate.
      }
    }

    console.error("Could not find a working Python interpreter for src/app/app.py.");
    process.exit(1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
