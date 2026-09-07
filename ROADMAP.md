# Roadmap

## v1.0 — shipped ✅

- Apple **Notes**: folders, search, read, create
- Apple **Reminders**: lists, list/search, create (with due dates), complete, delete
- Apple **Calendar**: calendars, list/search events by date range, create events
- Safe-by-design JXA bridge (input passed as JSON args, never interpolated into scripts)
- Friendly errors for macOS permission and timeout problems
- MCP tool annotations (read-only / destructive hints)
- Smoke test + GitHub Actions CI

## v1.1 — more apps

- **Contacts**: search people, read phone/email/address
- **Mail**: search mailboxes, read messages, create drafts (no auto-send)
- **Messages**: read recent conversations, send a message (client confirms first)
- Edit tools for existing apps: append to a note, update/delete a calendar event,
  update a reminder (rename, reschedule, move between lists)

## v1.2 — quality of life

- Publish to npm so install is just `npx apple-mcp@latest`
- Homebrew formula
- Configurable module enable/disable (e.g. `--apps notes,calendar`) so users can
  grant only the access they want
- Localized folder/list name handling improvements

## v2.0 — native backend

- Optional Swift/EventKit helper binary for Calendar and Reminders:
  - much faster on large libraries
  - expands **recurring events** into real occurrences (the current AppleScript
    interface can't)
  - proper time-zone metadata
- Falls back to the JXA backend automatically when the helper isn't built

## Ideas (help wanted)

- Photos (search by album/date, export)
- Safari (reading list, bookmarks)
- Music (now playing, playback control)
- Shortcuts (run a shortcut by name — a gateway to almost everything else)

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
