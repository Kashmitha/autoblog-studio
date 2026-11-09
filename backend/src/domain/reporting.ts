import { DateTime } from "luxon";
export class ReportReadError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function reportingRange(start: string, end: string) {
  const parse = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? DateTime.fromISO(value, { zone: "UTC" })
      : DateTime.invalid("Invalid date");
  const s = parse(start),
    e = parse(end);
  return (
    s.isValid &&
    e.isValid &&
    s.toISODate() === start &&
    e.toISODate() === end &&
    e >= s &&
    e.diff(s, "days").days < 93
  );
}
export function automaticTrafficRange(
  bootstrap: boolean,
  now: DateTime = DateTime.now(),
) {
  const end = now
    .setZone("America/Los_Angeles")
    .startOf("day")
    .minus({ days: 1 });
  return {
    start: end.minus({ days: bootstrap ? 55 : 6 }).toISODate()!,
    end: end.toISODate()!,
  };
}
export const nextTrafficSync = (state: string, startedAt: Date) =>
  new Date(
    startedAt.getTime() +
      (state === "RUNNING"
        ? 15 * 60000
        : state === "FAILED"
          ? 3600000
          : 86400000),
  );
