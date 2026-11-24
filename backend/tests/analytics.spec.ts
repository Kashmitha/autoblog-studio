import {
  analyticsHost,
  analyticsRow,
  validGaProperty,
  validMeasurementId,
} from "../src/domain/analytics";
test("GA4 numeric property and G- measurement identifiers are distinct", () => {
  expect(validGaProperty("123456789")).toBe(true);
  expect(validGaProperty("G-ABCDEF1234")).toBe(false);
  expect(validMeasurementId("G-ABCDEF1234")).toBe(true);
  expect(validMeasurementId("123456789")).toBe(false);
  expect(validGaProperty("properties/123")).toBe(false);
  expect(validMeasurementId("G-ABC<script>")).toBe(false);
});
test("blog scope accepts only HTTPS destinations without credentials or custom ports", () => {
  expect(analyticsHost("https://Blog.Example/post")).toBe("blog.example");
  for (const url of [
    "http://blog.example/",
    "https://user:secret@blog.example/",
    "https://blog.example:4000/",
    "bad",
  ])
    expect(analyticsHost(url)).toBeNull();
});
const row = (
  date = "20261115",
  url = "https://blog.example/post",
  value = "0",
) => ({
  dimensionValues: [{ value: date }, { value: url }],
  metricValues: [{ value }],
});
test("explicit reported zero pageviews are retained while missing/invalid counts are rejected", () => {
  expect(
    analyticsRow(row(), "blog.example", "2026-11-01", "2026-11-16"),
  ).toMatchObject({ pageviews: 0, date: "2026-11-15" });
  for (const value of ["", "1.5", "-1", "2147483648"])
    expect(
      analyticsRow(
        row("20261115", "https://blog.example/post", value),
        "blog.example",
        "2026-11-01",
        "2026-11-16",
      ),
    ).toBeNull();
});
test("report rows cannot cross date ranges, domains or protocols", () => {
  for (const r of [
    row("20260230"),
    row("20261201"),
    row("20261115", "https://foreign.example/post"),
    row("20261115", "http://blog.example/post"),
  ])
    expect(
      analyticsRow(r, "blog.example", "2026-11-01", "2026-11-16"),
    ).toBeNull();
});
