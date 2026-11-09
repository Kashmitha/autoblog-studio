export interface PerformanceMetric {
  date: Date;
  url: string;
  source: string;
  pageviews: number | null;
  impressions: number | null;
  clicks: number | null;
}
export function performanceUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    // Blogger's mobile rendering variants refer to the same article. Preserve
    // every other query parameter and do not merge different hosts/protocols.
    if (
      url.hostname.endsWith(".blogspot.com") &&
      url.searchParams.getAll("m").every((v) => v === "0" || v === "1")
    )
      url.searchParams.delete("m");
    return url.href;
  } catch {
    return null;
  }
}
const choose = (
  rows: PerformanceMetric[],
  fields: ("pageviews" | "impressions" | "clicks")[],
  preferred: string,
) => {
  const sources = [
    ...new Set(
      rows
        .filter((row) => fields.some((field) => row[field] !== null))
        .map((row) => row.source),
    ),
  ].sort();
  return sources.includes(preferred)
    ? preferred
    : sources.includes("MANUAL")
      ? "MANUAL"
      : sources[0] || null;
};
function sum(
  rows: PerformanceMetric[],
  field: "pageviews" | "impressions" | "clicks",
) {
  const values = rows.filter((row) => row[field] !== null);
  return values.length
    ? values.reduce((total, row) => total + row[field]!, 0)
    : null;
}
export function articlePerformance(
  rows: PerformanceMetric[],
  currentStart: string,
) {
  // Select one source for BOTH comparison periods, so switching sources cannot
  // manufacture a growth percentage or double count CSV and API observations.
  const viewSource = choose(rows, ["pageviews"], "GOOGLE_ANALYTICS");
  const searchSource = choose(
    rows,
    ["clicks", "impressions"],
    "SEARCH_CONSOLE",
  );
  const period = (current: boolean) => {
    const within = rows.filter(
      (row) => row.date.toISOString().slice(0, 10) >= currentStart === current,
    );
    const views = within.filter(
      (row) => row.source === viewSource && row.pageviews !== null,
    );
    const search = within.filter(
      (row) =>
        row.source === searchSource &&
        (row.clicks !== null || row.impressions !== null),
    );
    const pageviews = sum(views, "pageviews"),
      clicks = sum(search, "clicks"),
      impressions = sum(search, "impressions");
    const observed = [...views, ...search];
    const dates = [
      ...new Set(observed.map((row) => row.date.toISOString().slice(0, 10))),
    ].sort();
    return {
      pageviews,
      clicks,
      impressions,
      ctr:
        impressions !== null &&
        impressions > 0 &&
        clicks !== null &&
        search.every((row) => row.clicks !== null && row.impressions !== null)
          ? (clicks / impressions) * 100
          : null,
      daysReported: dates.length,
      latestReportedDate: dates.at(-1) || null,
      viewDaysReported: new Set(
        views.map((row) => row.date.toISOString().slice(0, 10)),
      ).size,
      searchDaysReported: new Set(
        search.map((row) => row.date.toISOString().slice(0, 10)),
      ).size,
    };
  };
  const current = period(true),
    previous = period(false);
  const change = (field: "pageviews" | "clicks" | "impressions") =>
    current[field] === null || previous[field] === null
      ? null
      : {
          absolute: current[field]! - previous[field]!,
          percent:
            previous[field]! > 0
              ? ((current[field]! - previous[field]!) / previous[field]!) * 100
              : null,
        };
  return {
    current,
    previous,
    viewSource,
    searchSource,
    changes: {
      clicks: change("clicks"),
      impressions: change("impressions"),
      pageviews: change("pageviews"),
    },
  };
}

// Spreadsheet apps can execute formula-looking text even inside quoted CSV.
export function csvCell(value: unknown) {
  const string = value === null || value === undefined ? "" : String(value);
  const safe =
    typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(string)
      ? "'" + string
      : string;
  return '"' + safe.replaceAll('"', '""') + '"';
}
