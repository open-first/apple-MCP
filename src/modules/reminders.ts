import { z } from "zod";
import { runJxa } from "../jxa.js";
import type { AppleModule } from "./types.js";

// ---------------------------------------------------------------------------
// JXA scripts. Static strings — user input arrives only via argv[0] as JSON.
// ---------------------------------------------------------------------------

const LIST_LISTS = `
function run(argv) {
  var app = Application("Reminders");
  var lists = app.lists();
  var out = [];
  for (var i = 0; i < lists.length; i++) {
    out.push({ name: lists[i].name(), id: lists[i].id() });
  }
  return JSON.stringify(out);
}`;

const LIST_REMINDERS = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Reminders");
  var limit = p.limit || 25;
  var lists = app.lists();
  var rows = [];
  var foundList = !p.list;

  for (var li = 0; li < lists.length; li++) {
    var list = lists[li];
    var listName = list.name();
    if (p.list && listName.toLowerCase() !== p.list.toLowerCase()) continue;
    foundList = true;

    var conds = [];
    if (!p.includeCompleted) conds.push({ completed: false });
    if (p.search) conds.push({ name: { _contains: p.search } });

    var base = list.reminders;
    var matched = conds.length === 0 ? base
      : conds.length === 1 ? base.whose(conds[0])
      : base.whose({ _and: conds });

    var ids, names, dues, bodies, completeds;
    try {
      ids = matched.id();
      names = matched.name();
      dues = matched.dueDate();
      bodies = matched.body();
      completeds = matched.completed();
    } catch (e) { continue; }

    for (var i = 0; i < ids.length; i++) {
      rows.push({
        id: ids[i],
        name: names[i],
        list: listName,
        dueDate: dues[i] ? dues[i].toISOString() : null,
        notes: bodies[i] || null,
        completed: completeds[i] === true
      });
    }
  }

  if (!foundList) {
    var names2 = [];
    for (var x = 0; x < lists.length; x++) names2.push(lists[x].name());
    throw new Error("List not found: " + p.list + ". Available lists: " + names2.join(", "));
  }

  rows.sort(function (a, b) {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
  rows = rows.slice(0, limit);
  return JSON.stringify({ count: rows.length, reminders: rows });
}`;

const CREATE_REMINDER = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Reminders");

  var list = null;
  if (p.list) {
    var lists = app.lists();
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].name().toLowerCase() === p.list.toLowerCase()) { list = lists[i]; break; }
    }
    if (!list) {
      var names = [];
      for (var x = 0; x < lists.length; x++) names.push(lists[x].name());
      throw new Error("List not found: " + p.list + ". Available lists: " + names.join(", "));
    }
  } else {
    try { list = app.defaultList(); } catch (e) {}
    if (!list) list = app.lists()[0];
    if (!list) throw new Error("No reminder lists exist. Create one in the Reminders app first.");
  }

  var props = { name: p.name };
  if (p.notes) props.body = p.notes;
  if (p.dueDate) {
    var d = new Date(p.dueDate);
    if (isNaN(d.getTime())) throw new Error("Invalid dueDate: " + p.dueDate + ". Use ISO format like 2026-09-08T14:00:00");
    props.dueDate = d;
  }

  var reminder = app.Reminder(props);
  list.reminders.push(reminder);
  return JSON.stringify({
    id: reminder.id(),
    name: reminder.name(),
    list: list.name(),
    dueDate: reminder.dueDate() ? reminder.dueDate().toISOString() : null
  });
}`;

const COMPLETE_REMINDER = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Reminders");
  var reminder = app.reminders.byId(p.id);
  var name = reminder.name();
  reminder.completed = true;
  return JSON.stringify({ id: p.id, name: name, completed: true });
}`;

const DELETE_REMINDER = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Reminders");
  var reminder = app.reminders.byId(p.id);
  var name = reminder.name();
  app.delete(reminder);
  return JSON.stringify({ deleted: true, id: p.id, name: name });
}`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const remindersModule: AppleModule = {
  app: "Reminders",
  tools: [
    {
      name: "reminders_lists",
      title: "List reminder lists",
      description: "List all lists in Apple Reminders (name and id).",
      schema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: () => runJxa(LIST_LISTS),
    },
    {
      name: "reminders_list",
      title: "List / search reminders",
      description:
        "List reminders from Apple Reminders, sorted by due date. By default shows only incomplete reminders across all lists. Filter by list name, search text in titles, or include completed items.",
      schema: {
        list: z.string().optional().describe("Only show reminders from this list (see reminders_lists)."),
        search: z.string().optional().describe("Only show reminders whose title contains this text."),
        includeCompleted: z.boolean().optional().describe("Also include completed reminders. Default false."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results. Default 25."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: (args) => runJxa(LIST_REMINDERS, args),
    },
    {
      name: "reminders_create",
      title: "Create a reminder",
      description:
        "Create a new reminder in Apple Reminders, optionally with notes, a due date, and a target list (defaults to the user's default list).",
      schema: {
        name: z.string().min(1).describe("The reminder title."),
        notes: z.string().optional().describe("Additional notes for the reminder."),
        dueDate: z
          .string()
          .optional()
          .describe(
            "Due date/time in ISO 8601, e.g. 2026-09-08T14:00:00. A time without timezone offset is treated as the Mac's local time."
          ),
        list: z.string().optional().describe("List to add the reminder to (see reminders_lists)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      handler: (args) => runJxa(CREATE_REMINDER, args),
    },
    {
      name: "reminders_complete",
      title: "Complete a reminder",
      description: "Mark a reminder as completed by id (get ids from reminders_list).",
      schema: {
        id: z.string().describe("Reminder id, e.g. from reminders_list."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      handler: (args) => runJxa(COMPLETE_REMINDER, args),
    },
    {
      name: "reminders_delete",
      title: "Delete a reminder",
      description:
        "Permanently delete a reminder by id. This cannot be undone — prefer reminders_complete unless the user explicitly asks to delete.",
      schema: {
        id: z.string().describe("Reminder id, e.g. from reminders_list."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      handler: (args) => runJxa(DELETE_REMINDER, args),
    },
  ],
};
