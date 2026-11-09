import { DateTime } from "luxon";
import {
  automaticTrafficRange,
  reportingRange,
  nextTrafficSync,
} from "../src/domain/reporting";
test("report date validation rejects impossible, reversed, timestamp and overlong ranges", () => {
  expect(reportingRange("2026-02-30", "2026-03-01")).toBe(false);
  expect(reportingRange("2026-11-02", "2026-11-01")).toBe(false);
  expect(reportingRange("2026-11-01T00:00:00Z", "2026-11-02")).toBe(false);
  expect(reportingRange("2026-01-01", "2026-04-03")).toBe(true);
  expect(reportingRange("2026-01-01", "2026-04-04")).toBe(false);
});
test("automatic imports use complete Pacific calendar days across daylight saving", () => {
  const now = DateTime.fromISO("2026-11-02T04:00:00Z"); // Still Nov 1 in Pacific.
  expect(automaticTrafficRange(false, now)).toEqual({
    start: "2026-10-25",
    end: "2026-10-31",
  });
  const window = automaticTrafficRange(true, now);
  expect(
    DateTime.fromISO(window.end).diff(DateTime.fromISO(window.start), "days")
      .days + 1,
  ).toBe(56);
});
test("daily reads, failed attempts and interrupted leases use separate timing", () => {
  const start = new Date("2026-11-06T12:00:00Z");
  expect(nextTrafficSync("EMPTY", start).getTime() - start.getTime()).toBe(
    86400000,
  );
  expect(nextTrafficSync("FAILED", start).getTime() - start.getTime()).toBe(
    3600000,
  );
  expect(nextTrafficSync("RUNNING", start).getTime() - start.getTime()).toBe(
    900000,
  );
});
