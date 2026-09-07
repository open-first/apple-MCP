# apple-mcp

**Talk to Apple Reminders, Notes, and Calendar from Claude — or any AI app that speaks MCP.**

apple-mcp is a free, open-source [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for macOS. Once connected, your AI assistant can do things like:

- *"What's on my calendar this week?"*
- *"Remind me to call the dentist tomorrow at 9am"*
- *"Find my note about the trip to Japan and summarize it"*
- *"Create a note with the meeting summary and add the action items to my Reminders"*

It uses macOS's **built-in automation** (Apple events via `osascript`) — no Apple developer account, no API keys, no cloud services, nothing to sign up for. Your data never leaves your Mac except through the AI client you connect it to.

## Requirements

- macOS (any recent version; tested on macOS 15+)
- [Node.js](https://nodejs.org) 18 or newer (`node --version` to check)

## Install

```bash
git clone https://github.com/open-first/apple-MCP.git
cd apple-MCP
npm install
```

That's it — `npm install` also compiles the server into `dist/`.

## Connect to Claude Desktop

1. Open the file `~/Library/Application Support/Claude/claude_desktop_config.json` (create it if it doesn't exist).
2. Add the server, using the **absolute path** to where you cloned this repo:

```json
{
  "mcpServers": {
    "apple": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/apple-mcp/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop. You should see the tools under the 🔌 icon.

## Connect to Claude Code

```bash
claude mcp add apple -- node /Users/YOUR_USERNAME/apple-mcp/dist/index.js
```

Any other MCP client works the same way: run `node dist/index.js` as a stdio server.

## macOS permissions (first run)

The **first time** a tool touches each app, macOS shows a prompt like *"Claude would like to control Notes"*. Click **Allow** — once per app.

If you accidentally denied it, or nothing happens: open **System Settings → Privacy & Security → Automation**, find the app that runs the server (Claude, Terminal, etc.) and enable the toggles for Notes, Reminders, and Calendar.

## Tools

| Tool | What it does |
|---|---|
| `notes_folders` | List Notes folders across all accounts |
| `notes_search` | Search notes by text, or list recent notes |
| `notes_get` | Read a full note (text or HTML) |
| `notes_create` | Create a note (optionally in a folder) |
| `reminders_lists` | List reminder lists |
| `reminders_list` | List/search reminders (filter by list, completed, text) |
| `reminders_create` | Create a reminder with notes + due date |
| `reminders_complete` | Mark a reminder done |
| `reminders_delete` | Delete a reminder (permanent — the assistant is told to prefer completing) |
| `calendar_calendars` | List calendars |
| `calendar_events` | List/search events in a date range |
| `calendar_create_event` | Create an event (title, time, location, notes, all-day) |

All read tools are marked read-only and the delete tool is marked destructive, so well-behaved MCP clients ask before doing anything risky.

## Troubleshooting

**"macOS blocked automation access"** — grant the permission (see above), then retry.

**A call times out** — check your Mac's screen: a permission prompt is probably waiting. Also, very large libraries (thousands of notes/events) can be slow through Apple's scripting interface; narrow the search with a folder, list, calendar, or date range.

**Repeating calendar events show only their original date** — a limitation of Apple's scripting interface; individual occurrences aren't expanded. A native EventKit backend that fixes this is on the [roadmap](ROADMAP.md).

**Test everything without an AI client:**

```bash
npm run inspector
```

opens the MCP Inspector, a web UI where you can call each tool by hand.

## How it works / adding more Apple apps

Each Apple app is one file in [`src/modules/`](src/modules) — a set of small JXA (JavaScript for Automation) scripts plus MCP tool definitions. The server passes user input to the scripts as JSON arguments (never by pasting it into script code, so there's no injection risk) and returns JSON back.

Want Mail, Messages, or Contacts? See [CONTRIBUTING.md](CONTRIBUTING.md) — a new app is typically under 150 lines, and the [ROADMAP.md](ROADMAP.md) lists what's planned.

## License

[MIT](LICENSE) — free forever, for everyone.
