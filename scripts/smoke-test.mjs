// Smoke test: starts the server, performs the MCP handshake, and verifies
// all expected tools are registered. Makes NO calls to Apple apps, so it is
// safe to run anywhere (including CI on macOS runners without TCC access).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = spawn("node", [join(root, "dist/index.js")], {
  stdio: ["pipe", "pipe", "ignore"],
});

const EXPECTED = [
  "notes_folders",
  "notes_search",
  "notes_get",
  "notes_create",
  "reminders_lists",
  "reminders_list",
  "reminders_create",
  "reminders_complete",
  "reminders_delete",
  "calendar_calendars",
  "calendar_events",
  "calendar_create_event",
];

const pending = new Map();
let nextId = 1;
let buf = "";
server.stdout.on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const p = new Promise((res, rej) => {
    pending.set(id, res);
    setTimeout(() => rej(new Error("timeout waiting for " + method)), 15000);
  });
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p;
}

try {
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0" },
  });
  if (init.result?.serverInfo?.name !== "apple-mcp") {
    throw new Error("unexpected serverInfo: " + JSON.stringify(init.result?.serverInfo));
  }
  server.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
  );

  const list = await send("tools/list", {});
  const names = (list.result?.tools ?? []).map((t) => t.name);
  const missing = EXPECTED.filter((n) => !names.includes(n));
  if (missing.length) throw new Error("missing tools: " + missing.join(", "));

  console.log("PASS: handshake ok, " + names.length + " tools registered");
  server.kill();
  process.exit(0);
} catch (err) {
  console.error("FAIL:", err.message);
  server.kill();
  process.exit(1);
}
