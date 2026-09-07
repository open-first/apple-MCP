/**
 * Runs JXA (JavaScript for Automation) scripts via macOS's built-in
 * `osascript` binary. This is how the server talks to Notes, Reminders,
 * Calendar, and (in the future) other Apple apps.
 *
 * Security note: scripts are static strings defined in this codebase.
 * All dynamic values (user input) are passed as a JSON argument via
 * `argv`, never interpolated into the script source, so there is no
 * script-injection surface. `execFile` is used (no shell involved).
 */
import { execFile } from "node:child_process";

const OSASCRIPT = "/usr/bin/osascript";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

export class JxaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JxaError";
  }
}

function friendlyMessage(
  error: { message?: string; killed?: boolean },
  stderr: string
): string {
  const detail = (stderr || error.message || "").trim();

  if (/-1743|Not authorized to send Apple events/i.test(detail)) {
    return (
      "macOS blocked automation access. Fix: open System Settings → Privacy & Security → " +
      "Automation, find the app that runs this MCP server (e.g. Claude or your terminal), " +
      "and enable the toggle for the Apple app you tried to use. Then retry. " +
      "If no toggle appears yet, retry once — macOS shows a one-time permission prompt on first use. " +
      "(Original error: " + detail + ")"
    );
  }
  if (error.killed || /-1712|timed? ?out/i.test(detail)) {
    return (
      "The request to the Apple app timed out. Possible causes: a macOS permission prompt is " +
      "waiting on screen (check your Mac), the app is doing a first-launch sync, or the query " +
      "was too broad. Try again with a specific list/folder/calendar, a narrower date range, " +
      "or a smaller limit. (Original error: " + detail + ")"
    );
  }
  if (/-1728/.test(detail)) {
    return "Item not found. It may have been deleted or the id is stale. (" + detail + ")";
  }
  return detail || "osascript failed with an unknown error";
}

/**
 * Execute a JXA script. `params` is serialized to JSON and made available
 * to the script as `argv[0]` inside its `run(argv)` handler. The script
 * must return a JSON string (or nothing).
 */
export function runJxa<T>(
  script: string,
  params: unknown = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  if (process.platform !== "darwin") {
    return Promise.reject(
      new JxaError("apple-mcp only works on macOS — it drives Apple apps via Apple events.")
    );
  }
  return new Promise((resolve, reject) => {
    execFile(
      OSASCRIPT,
      ["-l", "JavaScript", "-e", script, JSON.stringify(params)],
      { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new JxaError(friendlyMessage(error, stderr ?? "")));
        }
        const out = (stdout ?? "").trim();
        if (!out) return resolve(undefined as T);
        try {
          resolve(JSON.parse(out) as T);
        } catch {
          reject(
            new JxaError("Could not parse osascript output as JSON: " + out.slice(0, 500))
          );
        }
      }
    );
  });
}
