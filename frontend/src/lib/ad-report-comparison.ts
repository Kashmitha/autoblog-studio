import type { parseAdsterraReport } from "./adsterra-report";

export type AdReportSummary = {
  id: string;
  filename: string;
  scopeLabel: string;
  timezoneLabel: string;
  createdAt: string;
};
export type AdReportSnapshot = AdReportSummary & {
  report: ReturnType<typeof parseAdsterraReport>;
};
type DailyRow = AdReportSnapshot["report"]["rows"][number];

const summarize = (rows: DailyRow[]) =>
  rows.length
    ? {
        dates: rows.map((row) => row.date),
        impressions: rows.reduce((total, row) => total + row.impressions, 0),
        clicks: rows.reduce((total, row) => total + row.clicks, 0),
        revenue: rows.reduce((total, row) => total + row.revenue, 0),
      }
    : null;

export function compareAdReports(
  previous: AdReportSnapshot,
  current: AdReportSnapshot,
) {
  const normalize = (value: string) => value.trim().toLowerCase();
  for (const [field, description] of [
    ["scopeLabel", "domain filters"],
    ["timezoneLabel", "timezones"],
  ] as const) {
    if (
      normalize(previous[field]) &&
      normalize(current[field]) &&
      normalize(previous[field]) !== normalize(current[field])
    )
      return {
        kind: "mismatch" as const,
        reason: `The recorded ${description} differ. Choose reports with matching filters and timezone.`,
      };
  }
  const unknown =
    !previous.scopeLabel.trim() ||
    !current.scopeLabel.trim() ||
    !previous.timezoneLabel.trim() ||
    !current.timezoneLabel.trim();
  const previousRows = new Map(
    previous.report.rows.map((row) => [row.date, row]),
  );
  const currentRows = new Map(
    current.report.rows.map((row) => [row.date, row]),
  );
  const dates = [
    ...new Set([...previousRows.keys(), ...currentRows.keys()]),
  ].sort();
  const rows = dates.map((date) => ({
    date,
    previous: previousRows.get(date) ?? null,
    current: currentRows.get(date) ?? null,
  }));
  const matching = rows.filter((row) => row.previous && row.current);
  return {
    kind: unknown ? ("unknown-scope" as const) : ("matching-labels" as const),
    rows,
    matchingPrevious: summarize(matching.map((row) => row.previous!)),
    matchingCurrent: summarize(matching.map((row) => row.current!)),
    onlyPrevious: summarize(
      rows
        .filter((row) => row.previous && !row.current)
        .map((row) => row.previous!),
    ),
    onlyCurrent: summarize(
      rows
        .filter((row) => row.current && !row.previous)
        .map((row) => row.current!),
    ),
  };
}
