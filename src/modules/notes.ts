import { z } from "zod";
import { runJxa } from "../jxa.js";
import type { AppleModule } from "./types.js";

// ---------------------------------------------------------------------------
// JXA scripts. Static strings — user input arrives only via argv[0] as JSON.
// ---------------------------------------------------------------------------

const LIST_FOLDERS = `
function run(argv) {
  var app = Application("Notes");
  var out = [];
  var accounts = app.accounts();
  for (var a = 0; a < accounts.length; a++) {
    var accName = accounts[a].name();
    var folders = accounts[a].folders();
    for (var f = 0; f < folders.length; f++) {
      try {
        out.push({
          account: accName,
          name: folders[f].name(),
          noteCount: folders[f].notes.length
        });
      } catch (e) {}
    }
  }
  return JSON.stringify(out);
}`;

const SEARCH_NOTES = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Notes");
  var limit = p.limit || 10;

  function findFolder(name) {
    var accounts = app.accounts();
    for (var a = 0; a < accounts.length; a++) {
      var folders = accounts[a].folders();
      for (var f = 0; f < folders.length; f++) {
        if (folders[f].name().toLowerCase() === name.toLowerCase()) return folders[f];
      }
    }
    return null;
  }

  var source = app.notes;
  if (p.folder) {
    var folder = findFolder(p.folder);
    if (!folder) throw new Error("Folder not found: " + p.folder + ". Use notes_folders to list folders.");
    source = folder.notes;
  }

  var matched = source;
  if (p.query) {
    matched = source.whose({
      _or: [
        { name: { _contains: p.query } },
        { plaintext: { _contains: p.query } }
      ]
    });
  }

  var ids = matched.id();
  var names = matched.name();
  var mods = matched.modificationDate();
  var rows = [];
  for (var i = 0; i < ids.length; i++) {
    rows.push({
      id: ids[i],
      name: names[i],
      modified: mods[i] ? mods[i].toISOString() : null
    });
  }
  rows.sort(function (x, y) { return (y.modified || "").localeCompare(x.modified || ""); });
  rows = rows.slice(0, limit);

  for (var j = 0; j < rows.length; j++) {
    try {
      var txt = app.notes.byId(rows[j].id).plaintext();
      rows[j].snippet = txt ? txt.replace(/\\s+/g, " ").trim().slice(0, 200) : "";
    } catch (e) {
      rows[j].snippet = null;
    }
  }
  return JSON.stringify({ count: rows.length, notes: rows });
}`;

const GET_NOTE = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Notes");
  var note = app.notes.byId(p.id);
  var out = {
    id: note.id(),
    name: note.name(),
    created: note.creationDate() ? note.creationDate().toISOString() : null,
    modified: note.modificationDate() ? note.modificationDate().toISOString() : null
  };
  try { out.folder = note.container().name(); } catch (e) {}
  out.body = p.format === "html" ? note.body() : note.plaintext();
  return JSON.stringify(out);
}`;

const CREATE_NOTE = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Notes");

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  var html = "<div><b>" + esc(p.title) + "</b></div>";
  var lines = String(p.body || "").split("\\n");
  for (var i = 0; i < lines.length; i++) {
    html += "<div>" + (lines[i] ? esc(lines[i]) : "<br>") + "</div>";
  }

  var target = null;
  if (p.folder) {
    var accounts = app.accounts();
    for (var a = 0; a < accounts.length && !target; a++) {
      var folders = accounts[a].folders();
      for (var f = 0; f < folders.length; f++) {
        if (folders[f].name().toLowerCase() === p.folder.toLowerCase()) { target = folders[f]; break; }
      }
    }
    if (!target) throw new Error("Folder not found: " + p.folder + ". Use notes_folders to list folders.");
  }

  var note = app.Note({ body: html });
  if (target) {
    target.notes.push(note);
  } else {
    app.notes.push(note);
  }
  var out = { id: note.id(), name: note.name() };
  try { out.folder = note.container().name(); } catch (e) {}
  return JSON.stringify(out);
}`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const notesModule: AppleModule = {
  app: "Notes",
  tools: [
    {
      name: "notes_folders",
      title: "List Notes folders",
      description:
        "List all folders in Apple Notes across every account (iCloud, On My Mac, ...), with note counts.",
      schema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: () => runJxa(LIST_FOLDERS),
    },
    {
      name: "notes_search",
      title: "Search notes",
      description:
        "Search Apple Notes by text (matches title and body), or list the most recently modified notes when no query is given. Returns id, title, modification date, and a snippet for each match. Use notes_get with an id to read a full note.",
      schema: {
        query: z.string().optional().describe("Text to search for in note titles and bodies. Omit to list recent notes."),
        folder: z.string().optional().describe("Restrict the search to one folder (as returned by notes_folders)."),
        limit: z.number().int().min(1).max(50).optional().describe("Max results to return. Default 10."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: (args) => runJxa(SEARCH_NOTES, args),
    },
    {
      name: "notes_get",
      title: "Read a note",
      description:
        "Read the full content of one Apple Note by id (get ids from notes_search). Returns plain text by default; pass format: 'html' for the raw HTML body.",
      schema: {
        id: z.string().describe("Note id, e.g. from notes_search."),
        format: z.enum(["text", "html"]).optional().describe("Body format. Default 'text'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: (args) => runJxa(GET_NOTE, args),
    },
    {
      name: "notes_create",
      title: "Create a note",
      description:
        "Create a new note in Apple Notes with a title and plain-text body. Optionally place it in a specific folder; otherwise it goes to the default Notes folder.",
      schema: {
        title: z.string().min(1).describe("Note title (becomes the first line)."),
        body: z.string().optional().describe("Plain-text body. Newlines are preserved."),
        folder: z.string().optional().describe("Folder name to create the note in (see notes_folders)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      handler: (args) => runJxa(CREATE_NOTE, args),
    },
  ],
};
