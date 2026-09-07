import { z } from "zod";
import { runJxa } from "../jxa.js";
import type { AppleModule } from "./types.js";

// ---------------------------------------------------------------------------
// JXA scripts. Static strings — user input arrives only via argv[0] as JSON.
// ---------------------------------------------------------------------------

const LIST_CALENDARS = `
function run(argv) {
  var app = Application("Calendar");
  var cals = app.calendars();
  var out = [];
  for (var i = 0; i < cals.length; i++) {
    var row = { name: cals[i].name() };
    try { row.writable = cals[i].writable(); } catch (e) {}
    try { row.description = cals[i].description() || null; } catch (e) {}
    out.push(row);
  }
  return JSON.stringify(out);
}`;

const LIST_EVENTS = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Calendar");
  var start = new Date(p.start);
  var end = new Date(p.end);
  if (isNaN(start.getTime())) throw new Error("Invalid start date: " + p.start);
  if (isNaN(end.getTime())) throw new Error("Invalid end date: " + p.end);
  var limit = p.limit || 50;

  var cals = app.calendars();
  var rows = [];
  var foundCal = !p.calendar;

  for (var c = 0; c < cals.length; c++) {
    var cal = cals[c];
    var calName = cal.name();
    if (p.calendar && calName.toLowerCase() !== p.calendar.toLowerCase()) continue;
    foundCal = true;

    var conds = [
      { startDate: { _greaterThanEquals: start } },
      { startDate: { _lessThan: end } }
    ];
    if (p.search) conds.push({ summary: { _contains: p.search } });

    var evs = cal.events.whose({ _and: conds });
    var uids, summaries, starts, ends, locs, alldays;
    try {
      uids = evs.uid();
      summaries = evs.summary();
      starts = evs.startDate();
      ends = evs.endDate();
      locs = evs.location();
      alldays = evs.alldayEvent();
    } catch (e) { continue; }

    for (var i = 0; i < uids.length; i++) {
      rows.push({
        uid: uids[i],
        title: summaries[i],
        calendar: calName,
        start: starts[i] ? starts[i].toISOString() : null,
        end: ends[i] ? ends[i].toISOString() : null,
        location: locs[i] || null,
        allDay: alldays[i] === true
      });
    }
  }

  if (!foundCal) {
    var names = [];
    for (var x = 0; x < cals.length; x++) names.push(cals[x].name());
    throw new Error("Calendar not found: " + p.calendar + ". Available: " + names.join(", "));
  }

  rows.sort(function (a, b) { return (a.start || "").localeCompare(b.start || ""); });
  rows = rows.slice(0, limit);
  return JSON.stringify({ count: rows.length, events: rows });
}`;

const CREATE_EVENT = `
function run(argv) {
  var p = JSON.parse(argv[0] || "{}");
  var app = Application("Calendar");

  var cal = null;
  var cals = app.calendars();
  if (p.calendar) {
    for (var i = 0; i < cals.length; i++) {
      if (cals[i].name().toLowerCase() === p.calendar.toLowerCase()) { cal = cals[i]; break; }
    }
    if (!cal) {
      var names = [];
      for (var x = 0; x < cals.length; x++) names.push(cals[x].name());
      throw new Error("Calendar not found: " + p.calendar + ". Available: " + names.join(", "));
    }
  } else {
    for (var j = 0; j < cals.length; j++) {
      try { if (cals[j].writable()) { cal = cals[j]; break; } } catch (e) {}
    }
    if (!cal && cals.length > 0) cal = cals[0];
    if (!cal) throw new Error("No calendars found. Set one up in the Calendar app first.");
  }

  var startD = new Date(p.start);
  if (isNaN(startD.getTime())) throw new Error("Invalid start: " + p.start + ". Use ISO format like 2026-09-08T14:00:00");
  var endD = p.end ? new Date(p.end) : new Date(startD.getTime() + 60 * 60 * 1000);
  if (isNaN(endD.getTime())) throw new Error("Invalid end: " + p.end);
  if (endD <= startD) throw new Error("end must be after start");

  var props = { summary: p.title, startDate: startD, endDate: endD };
  if (p.location) props.location = p.location;
  if (p.notes) props.description = p.notes;
  if (p.allDay) props.alldayEvent = true;

  var ev = app.Event(props);
  cal.events.push(ev);

  var out = {
    title: p.title,
    calendar: cal.name(),
    start: startD.toISOString(),
    end: endD.toISOString(),
    allDay: !!p.allDay
  };
  try { out.uid = ev.uid(); } catch (e) {}
  return JSON.stringify(out);
}`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function defaultStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function defaultEnd(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export const calendarModule: AppleModule = {
  app: "Calendar",
  tools: [
    {
      name: "calendar_calendars",
      title: "List calendars",
      description: "List all calendars in Apple Calendar with their names and whether they are writable.",
      schema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: () => runJxa(LIST_CALENDARS, {}, 90_000),
    },
    {
      name: "calendar_events",
      title: "List calendar events",
      description:
        "List events from Apple Calendar in a date range (defaults to today through the next 7 days), sorted by start time. Optionally filter by calendar name or search text in event titles. Note: repeating events appear at their original start date only (an Apple scripting limitation).",
      schema: {
        start: z.string().optional().describe("Range start, ISO 8601 (e.g. 2026-09-07T00:00:00). Default: today at 00:00."),
        end: z.string().optional().describe("Range end, ISO 8601. Default: 7 days from now."),
        calendar: z.string().optional().describe("Only this calendar (see calendar_calendars)."),
        search: z.string().optional().describe("Only events whose title contains this text."),
        limit: z.number().int().min(1).max(200).optional().describe("Max results. Default 50."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      handler: (args) =>
        runJxa(
          LIST_EVENTS,
          { ...args, start: args.start ?? defaultStart(), end: args.end ?? defaultEnd() },
          90_000
        ),
    },
    {
      name: "calendar_create_event",
      title: "Create a calendar event",
      description:
        "Create a new event in Apple Calendar. Requires a title and start time; end defaults to one hour after start. Optionally set calendar, location, notes, or all-day.",
      schema: {
        title: z.string().min(1).describe("Event title."),
        start: z
          .string()
          .describe("Start date/time, ISO 8601 (e.g. 2026-09-08T14:00:00). A time without timezone offset is the Mac's local time."),
        end: z.string().optional().describe("End date/time, ISO 8601. Default: start + 1 hour."),
        calendar: z.string().optional().describe("Calendar to add to. Default: first writable calendar."),
        location: z.string().optional().describe("Event location."),
        notes: z.string().optional().describe("Event notes/description."),
        allDay: z.boolean().optional().describe("Create as an all-day event."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      handler: (args) => runJxa(CREATE_EVENT, args, 90_000),
    },
  ],
};
