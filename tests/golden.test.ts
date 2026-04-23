import { describe, it, expect } from "vitest";
import { parseAndRun } from "../src/lib/cron";
import fixtures from "./fixtures/golden.json";

interface Fixture {
  cron: string;
  tz: string;
  valid: boolean;
  desc_keyword?: string;
  note?: string;
}

describe("cron-explainer golden fixtures", () => {
  for (const f of fixtures as Fixture[]) {
    const label = `${f.valid ? "valid" : "invalid"}: "${f.cron}" [${f.tz}]`;
    it(label, () => {
      const r = parseAndRun(f.cron, f.tz, 3);
      expect(r.valid).toBe(f.valid);
      if (f.valid) {
        expect(r.next.length).toBeGreaterThan(0);
        // Next fire must parse as a real ISO 8601 date.
        for (const iso of r.next) {
          expect(Number.isFinite(Date.parse(iso))).toBe(true);
        }
        if (f.desc_keyword) {
          expect(String(r.description ?? "").toLowerCase()).toContain(
            f.desc_keyword.toLowerCase()
          );
        }
      } else {
        // Invalid → either errored out or produced no fires.
        const failed = r.errors.length > 0 || r.next.length === 0;
        expect(failed).toBe(true);
      }
    });
  }
});
