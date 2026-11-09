export type AdReportRow = {
  date: string;
  impressions: number;
  clicks: number;
  revenue: number;
  cpm: number;
};

// Native date-grouped export only. Quoted fields may contain commas and CRLF.
export function parseAdsterraReport(text: string) {
  if (new TextEncoder().encode(text).length > 1_000_000)
    throw new Error("Maximum report size is 1 MB.");
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (c !== ",") {
        if (row.some((value) => value.trim())) records.push(row);
        row = [];
        if (c === "\r" && input[i + 1] === "\n") i++;
      }
    } else {
      if (closed || c === '"') throw new Error("Malformed quoted CSV field.");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(field);
  if (row.some((value) => value.trim())) records.push(row);
  const header = records.shift()?.map((value) => value.trim().toLowerCase());
  const expected = ["date", "impressions", "clicks", "ctr", "cpm", "revenue"];
  if (
    !header ||
    header.length !== expected.length ||
    new Set(header).size !== header.length ||
    expected.some((key) => !header.includes(key))
  )
    throw new Error(
      "Use the Adsterra export grouped by Date: Date, Impressions, Clicks, CTR, CPM, Revenue.",
    );
  if (!records.length || records.length > 3660)
    throw new Error("Choose a report with 1–3660 daily rows.");
  const dates = new Set<string>();
  const rows = records
    .map((values, index): AdReportRow => {
      const fail = () =>
        new Error(`Invalid or duplicate daily data on CSV row ${index + 2}.`);
      if (values.length !== header.length) throw fail();
      const get = (key: string) => values[header.indexOf(key)].trim();
      const date = get("date").replaceAll("/", "-");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        dates.has(date)
      )
        throw fail();
      dates.add(date);
      const numeric = (key: string, currency = false) => {
        const raw = get(key).replace(currency ? /^\$/ : /$^/, "");
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) throw fail();
        const value = Number(raw.replaceAll(",", ""));
        if (!Number.isFinite(value) || value > 1e12) throw fail();
        return value;
      };
      const impressions = numeric("impressions"),
        clicks = numeric("clicks");
      const ctr = get("ctr");
      if (
        !Number.isSafeInteger(impressions) ||
        !Number.isSafeInteger(clicks) ||
        clicks > impressions ||
        !/^\d+(?:\.\d+)?%$/.test(ctr) ||
        Number(ctr.slice(0, -1)) > 100
      )
        throw fail();
      return {
        date,
        impressions,
        clicks,
        revenue: numeric("revenue", true),
        cpm: numeric("cpm", true),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return {
    rows,
    impressions,
    clicks,
    revenue,
    ctr: impressions ? (clicks / impressions) * 100 : null,
  };
}

export function adReportMoney(value: number) {
  if (value === 0) return "$0";
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 12 });
}
