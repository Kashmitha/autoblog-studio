"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ExternalLink, RefreshCw } from "lucide-react";
import { ArticlePerformanceReport } from "@/lib/types";
import { useResource } from "./hooks";
import { Field, Notice } from "./ui";
const number = (n: number | null) => (n === null ? "—" : n.toLocaleString());
const source = (s: string | null) =>
  s === "SEARCH_CONSOLE"
    ? "Google Search Console"
    : s === "GOOGLE_ANALYTICS"
      ? "Google Analytics"
      : s || "No recorded source";
export function ArticlePerformance() {
  const [days, setDays] = useState("28");
  return (
    <section className="panel padded spaced" aria-label="Article performance">
      <div className="panel-heading">
        <h2>Article performance</h2>
        <Field label="Performance period">
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">Last 7 completed days</option>
            <option value="28">Last 28 completed days</option>
            <option value="90">Last 90 completed days</option>
          </select>
        </Field>
      </div>
      <p className="subtle">
        See which published articles attract readers. Figures come from your
        saved Google reports or traffic imports; missing values are shown as —.
      </p>
      <PerformanceResults key={days} days={days} />
    </section>
  );
}
function PerformanceResults({ days }: { days: string }) {
  const r = useResource<ArticlePerformanceReport>(
    "/traffic/articles?days=" + days,
  );
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("clicks");
  const d = r.data;
  const rows =
    d?.articles
      .filter((a) =>
        (a.title + " " + a.url).toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : (b.current[sort as "clicks" | "impressions" | "pageviews"] ?? -1) -
              (a.current[sort as "clicks" | "impressions" | "pageviews"] ??
                -1) || a.title.localeCompare(b.title),
      ) || [];
  return (
    <>
      {r.error && (
        <Notice tone="warning">
          {r.error}{" "}
          <button className="text-button" onClick={() => void r.reload()}>
            Retry performance report
          </button>
        </Notice>
      )}
      {r.loading && <p role="status">Loading saved article reports…</p>}
      {d && (
        <>
          <p className="small">
            <strong>Current:</strong> {d.current.start} to {d.current.end}
            <br />
            <strong>Previous:</strong> {d.previous.start} to {d.previous.end}
          </p>
          <p className="small subtle">{d.dateConvention}</p>
          <div className="inline wrap spaced performance-controls">
            <Field label="Find a published article">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title or public URL"
              />
            </Field>
            <Field label="Sort article performance">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="clicks">Search clicks</option>
                <option value="impressions">Search impressions</option>
                <option value="pageviews">Pageviews</option>
                <option value="title">Article title</option>
              </select>
            </Field>
            <button className="secondary" onClick={() => void r.reload()}>
              <RefreshCw size={14} />
              Refresh saved reports
            </button>
            <a
              className="button secondary"
              href={"/api/traffic/articles/export?days=" + days}
              download
            >
              <ArrowDownToLine size={14} />
              Export full report CSV
            </a>
          </div>
          {d.truncated && (
            <Notice tone="warning">
              Showing {d.articles.length} of {d.totalPublished} published
              articles. The export has the same limit.
            </Notice>
          )}
          {!d.articles.length ? (
            <p className="subtle">
              Published articles will appear here after Blogger confirms
              publication.
            </p>
          ) : !rows.length ? (
            <p className="subtle">No published articles match your search.</p>
          ) : (
            <div className="table-scroll">
              <table className="article-performance-table">
                <thead>
                  <tr>
                    <th>Published article</th>
                    <th>Pageviews</th>
                    <th>Impressions</th>
                    <th>Search clicks</th>
                    <th>Search CTR</th>
                    <th>Reported click change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.articleId}>
                      <td>
                        <Link href={"/articles/" + a.articleId}>
                          <strong>{a.title}</strong>
                        </Link>
                        <p className="small">
                          <a
                            className="text-link break-url"
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.url} <ExternalLink size={12} />
                          </a>
                        </p>
                        <p className="small subtle">
                          {a.current.daysReported
                            ? `${a.current.daysReported} day(s) with recorded metrics · Latest: ${a.current.latestReportedDate}`
                            : "No recorded traffic for this period."}
                        </p>
                        <details>
                          <summary className="small">
                            Sources and coverage
                          </summary>
                          <p className="small">
                            Pageviews: {source(a.viewSource)} ·{" "}
                            {a.current.viewDaysReported}/{d.days} days with
                            values.
                            <br />
                            Search: {source(a.searchSource)} ·{" "}
                            {a.current.searchDaysReported}/{d.days} days with
                            values.
                            <br />
                            Previous period: {a.previous.daysReported}/{d.days}{" "}
                            days with recorded metrics.
                          </p>
                        </details>
                      </td>
                      <td data-label="Pageviews">
                        {number(a.current.pageviews)}
                        <small>Previous: {number(a.previous.pageviews)}</small>
                      </td>
                      <td data-label="Impressions">
                        {number(a.current.impressions)}
                        <small>
                          Previous: {number(a.previous.impressions)}
                        </small>
                      </td>
                      <td data-label="Search clicks">
                        {number(a.current.clicks)}
                        <small>Previous: {number(a.previous.clicks)}</small>
                      </td>
                      <td data-label="Search CTR">
                        {a.current.ctr === null
                          ? "—"
                          : a.current.ctr.toFixed(2) + "%"}
                      </td>
                      <td data-label="Reported click change">
                        {a.changes.clicks === null ? (
                          "—"
                        ) : (
                          <>
                            {a.changes.clicks.absolute > 0 ? "+" : ""}
                            {number(a.changes.clicks.absolute)}
                            {a.changes.clicks.percent !== null && (
                              <small>
                                {a.changes.clicks.percent > 0 ? "+" : ""}
                                {a.changes.clicks.percent.toFixed(1)}%
                              </small>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small subtle">{d.note}</p>
          <Notice>
            To add current data, use{" "}
            <strong>Sync official Google reports</strong> below. For
            comparisons, import dates covering both periods above. Refresh saved
            reports only reloads data already in Studio.
          </Notice>
        </>
      )}
    </>
  );
}
