/**
 * Thin wrapper around `croner` (MIT) + `cronstrue` (MIT).
 * croner:    https://github.com/Hexagon/croner     (MIT)
 * cronstrue: https://github.com/bradymholt/cRonstrue (MIT)
 *
 * License notices reproduced in /docs/notices.md and served at /legal/notices.
 */

import { Cron } from "croner";
import cronstrue from "cronstrue";

export interface ExplainResult {
  valid: boolean;
  description?: string;
  next: string[];
  flags: {
    dst_transition_ahead: boolean;
    ambiguous: boolean;
    notes: string[];
  };
  errors: string[];
}

const QUARTZ_HINT_RE = /^\s*\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s*(\S+)?\s*$/; // 6+ fields

function describe(expr: string): { description: string; notes: string[] } {
  const notes: string[] = [];
  try {
    const text = cronstrue.toString(expr, { use24HourTimeFormat: true });
    return { description: text, notes };
  } catch {
    notes.push("description_unavailable");
    return { description: "Cron expression parsed but could not be described.", notes };
  }
}

function detectDst(
  tz: string,
  fires: Date[]
): { dst_transition_ahead: boolean; notes: string[] } {
  const notes: string[] = [];
  if (fires.length < 2) return { dst_transition_ahead: false, notes };
  const offsets = fires.map((d) => tzOffsetMinutes(d, tz));
  let changed = false;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] !== offsets[i - 1]) {
      changed = true;
      notes.push(`tz_offset_change_between_fire_${i - 1}_and_${i}`);
    }
  }
  return { dst_transition_ahead: changed, notes };
}

function tzOffsetMinutes(date: Date, tz: string): number {
  // Returns the offset of `tz` relative to UTC at `date`, in minutes.
  // Relies on Intl.DateTimeFormat — available in Workers.
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asUtcMs = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );
    return Math.round((asUtcMs - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

export function parseAndRun(cron: string, tz: string, n: number): ExplainResult {
  const errors: string[] = [];
  const notes: string[] = [];

  // Quartz-style (6+ fields) is not supported by croner in POSIX mode.
  if (QUARTZ_HINT_RE.test(cron)) {
    notes.push("input_has_6+_fields_possible_quartz_seconds_or_year_unsupported");
  }

  let job: Cron;
  try {
    job = new Cron(cron, { timezone: tz });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse_error";
    return {
      valid: false,
      next: [],
      flags: { dst_transition_ahead: false, ambiguous: false, notes },
      errors: [msg],
    };
  }

  const next: Date[] = [];
  let cursor = new Date();
  for (let i = 0; i < n; i++) {
    const d = job.nextRun(cursor);
    if (!d) {
      notes.push(`no_more_fires_after_index_${i}`);
      break;
    }
    next.push(d);
    cursor = new Date(d.getTime() + 1000); // move past this fire
  }

  const { description, notes: descNotes } = describe(cron);
  notes.push(...descNotes);

  const { dst_transition_ahead, notes: dstNotes } = detectDst(tz, next);
  notes.push(...dstNotes);

  return {
    valid: errors.length === 0 && next.length > 0,
    description,
    next: next.map((d) => d.toISOString()),
    flags: {
      dst_transition_ahead,
      ambiguous: notes.some((n) => n.startsWith("input_has_6")),
      notes,
    },
    errors,
  };
}
