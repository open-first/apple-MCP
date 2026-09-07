<div align="center">

# 🍎 apple-mcp

**Give your AI assistant hands on your Mac — Apple Notes, Reminders, and Calendar over MCP.**

[![CI](https://github.com/open-first/apple-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/open-first/apple-MCP/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![macOS](https://img.shields.io/badge/macOS-only-black?logo=apple)
![Node 18+](https://img.shields.io/badge/Node-18%2B-brightgreen?logo=node.js&logoColor=white)

**No API keys · No cloud · No accounts · 100% local · Free forever**

</div>

---

Once connected, you just talk:

- 🗓️ *"What's on my calendar this week?"*
- ✅ *"Remind me to call the dentist tomorrow at 9am"*
- 📝 *"Find my note about the Japan trip and summarize it"*
- ✨ *"Save this meeting summary as a note and add the action items to my Reminders"*

apple-mcp is an [MCP](https://modelcontextprotocol.io) server that connects Claude Desktop, Claude Code, or any MCP client to the Apple apps you already use — through macOS's **built-in** automation. Your data never leaves your Mac except through the AI client you choose to connect.

## ⚡ Install in 60 seconds

You need a Mac and [Node.js](https://nodejs.org) 18+ (check with `node --version`).

```bash
git clone https://github.com/open-first/apple-MCP.git
cd apple-MCP
npm install
```

That's the whole install — `npm install` builds the server too.

## 🔌 Connect it

**Claude Desktop** — add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (create the file if it doesn't exist), with the absolute path to your clone:

```json
{
  "mcpServers": {
    "apple": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/apple-MCP/dist/index.js"]
    }
  }
}
```

Then quit Claude **fully** (⌘Q — closing the window isn't enough) and reopen it. The tools appear under the 🔌/sliders icon.

**Claude Code** — one command:

```bash
claude mcp add apple -- node /Users/YOUR_USERNAME/apple-MCP/dist/index.js
```

**Any other MCP client** — it's a standard stdio server: `node dist/index.js`.

## 🔐 First run: click "Allow"

The first time a tool touches each app, macOS asks — *"Claude would like to control Notes"*. Click **Allow**, once per app. That's the only setup.

(Denied it by accident? System Settings → Privacy & Security → **Automation** → find Claude → flip the toggles on.)

## 🧰 What it can do

12 tools across three apps:

| 📝 Notes | ✅ Reminders | 📅 Calendar |
|---|---|---|
| Search notes | List / search reminders | List events by date range |
| Read a full note | Create with due date + notes | Search events |
| Create a note | Mark complete | Create events (location, notes, all-day) |
| List folders | Delete | List calendars |

Read tools are marked **read-only** and delete is marked **destructive**, so well-behaved MCP clients ask you before anything risky happens.

## 🩹 Troubleshooting

| Symptom | Fix |
|---|---|
| "macOS blocked automation access" | Grant the permission (see above), retry |
| A call hangs or times out | A permission prompt is probably waiting on your screen. Huge libraries can also be slow — narrow by folder, list, calendar, or date range |
| Repeating events show only their first date | Apple scripting limitation; a native fix is on the [roadmap](ROADMAP.md) |
| Want to test without an AI client | `npm run inspector` opens a web UI to call every tool by hand |

## 🛠️ Add more Apple apps

Every app is **one file** in [`src/modules/`](src/modules) — small automation scripts plus tool definitions, usually under 150 lines. User input is passed as JSON data, never pasted into script code, so there's no injection risk.

Mail, Messages, and Contacts are next on the [roadmap](ROADMAP.md) — and [CONTRIBUTING.md](CONTRIBUTING.md) shows exactly how to add one. PRs welcome!

## 💬 Why this exists

A Reddit comment asked for one app connecting Apple Reminders, Notes, and Calendar to AI: *"It's crazy that Apple hasn't done this yet."* Apple still hasn't. So here it is — free, for everyone.

## 📄 License

[MIT](LICENSE) — do whatever you want with it.
