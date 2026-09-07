import type { AppleModule } from "./types.js";
import { notesModule } from "./notes.js";
import { remindersModule } from "./reminders.js";
import { calendarModule } from "./calendar.js";

/**
 * All enabled Apple app modules.
 *
 * To add support for another Apple app (Mail, Messages, Contacts, ...):
 *   1. Create src/modules/<app>.ts exporting an AppleModule
 *      (see notes.ts for the pattern: JXA scripts + tool definitions).
 *   2. Import it here and add it to this array. Done.
 */
export const modules: AppleModule[] = [notesModule, remindersModule, calendarModule];
