import { reportingRange } from "./reporting";
export const validGaProperty = (value: string) => /^\d{1,20}$/.test(value);
export const validMeasurementId = (value: string) =>
  /^G-[A-Z0-9]{4,20}$/.test(value);
export function analyticsHost(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.hostname.toLowerCase()
      : null;
  } catch {
    return null;
  }
}
export function analyticsRow(
  row: {
    dimensionValues?: { value?: string | null }[] | null;
    metricValues?: { value?: string | null }[] | null;
  },
  host: string,
  start: string,
  end: string,
) {
  const compact = row.dimensionValues?.[0]?.value;
  const url = row.dimensionValues?.[1]?.value;
  const value = row.metricValues?.[0]?.value;
  if (
    !compact ||
    !/^\d{8}$/.test(compact) ||
    !url ||
    url.length > 2048 ||
    analyticsHost(url) !== host ||
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 2147483647
  )
    return null;
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return reportingRange(date, date) && date >= start && date <= end
    ? { date, url, pageviews: Number(value) }
    : null;
}
