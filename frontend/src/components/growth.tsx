"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { api, post, formatDate } from "@/lib/api";
import { useAction, useResource } from "./hooks";
import { Field, Notice } from "./ui";
import type { Notify } from "./studio";

interface Pack {
  articleId: string;
  title: string;
  campaign: string;
  summary: string;
  note: string;
  channels: { source: string; label: string; url: string; text: string }[];
  related: { id: string; title: string; url: string; sharedTerms: string[] }[];
}
interface AudienceRow {
  label: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  pageviews: number;
}
interface GrowthReport {
  generatedAt: string;
  days: number;
  gaRange: { start: string; end: string };
  gaTimeZone: string;
  searchRange: { start: string; end: string };
  note: string;
  audience: {
    dimension: string;
    status: string;
    note?: string;
    rows: AudienceRow[];
  }[];
  queries: {
    status: string;
    note?: string;
    rows: {
      query: string;
      url: string;
      impressions: number;
      clicks: number;
      ctr: number;
      position: number;
      action: string;
    }[];
  };
}
const labels: Record<string, string> = {
  country: "Countries",
  sessionSourceMedium: "Traffic sources",
  sessionCampaignName: "Sharing campaigns",
  pagePath: "Popular pages",
};

export function GrowthTools({ notify }: { notify: Notify }) {
  const articles =
    useResource<{ id: string; title: string }[]>("/growth/articles");
  const action = useAction(notify);
  const [id, setId] = useState(""),
    [pack, setPack] = useState<Pack | null>(null);
  const [days, setDays] = useState("28"),
    [report, setReport] = useState<GrowthReport | null>(null);
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const selected = id || articles.data?.[0]?.id || "";
  const copy = (text: string) =>
    action.run(async () => {
      await navigator.clipboard.writeText(text);
      notify("Copied. Review the text before sharing.");
    });
  return (
    <section
      className="panel padded spaced growth-tools"
      aria-label="Audience growth tools"
    >
      <h2>Reach more readers</h2>
      <p className="subtle">
        Prepare a useful introduction to each article, share it where relevant,
        and see which countries and sources bring readers.
      </p>
      <div className="panel-heading wrap">
        <Field label="Published article to promote">
          <select
            value={selected}
            disabled={action.busy || articles.loading || !articles.data?.length}
            onChange={(e) => {
              setId(e.target.value);
              setPack(null);
            }}
          >
            {!articles.data?.length && (
              <option value="">No confirmed published articles yet</option>
            )}
            {articles.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="secondary"
          disabled={action.busy || !selected}
          onClick={() =>
            void action.run(async () =>
              setPack(
                await api<Pack>(`/growth/articles/${selected}/promotion`),
              ),
            )
          }
        >
          Prepare promotion pack
        </button>
      </div>
      {articles.error && (
        <Notice tone="warning">
          {articles.error}{" "}
          <button
            className="text-button"
            onClick={() => void articles.reload()}
          >
            Retry article list
          </button>
        </Notice>
      )}
      {pack && (
        <div className="growth-pack">
          <h3>{pack.title}</h3>
          <p className="small subtle">{pack.note}</p>
          <p className="small">
            Tracking campaign: <code>{pack.campaign}</code>
          </p>
          <div className="growth-channel-grid">
            {pack.channels.map((c) => (
              <section className="growth-channel" key={c.source}>
                <h3>{c.label}</h3>
                <Field label={`${c.label} sharing text`}>
                  <textarea rows={8} readOnly value={c.text} />
                </Field>
                <Field label={`${c.label} tracked link`}>
                  <input readOnly value={c.url} />
                </Field>
                <div className="inline wrap spaced">
                  <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void copy(c.text)}
                  >
                    <Copy size={15} /> Copy text
                  </button>
                  <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void copy(c.url)}
                  >
                    <Copy size={15} /> Copy tracked link
                  </button>
                </div>
              </section>
            ))}
          </div>
          <h3>Related published posts</h3>
          <p className="small subtle">
            Use these when preparing a related draft. The article editor also
            has “Find related posts” and an insert action for editable drafts.
          </p>
          {!pack.related.length ? (
            <p>No related published posts matched this article.</p>
          ) : (
            <ul>
              {pack.related.map((r) => (
                <li key={r.id}>
                  <Link href={`/articles/${r.id}`}>{r.title}</Link>{" "}
                  <button
                    className="text-button"
                    disabled={action.busy}
                    onClick={() => void copy(r.url)}
                  >
                    Copy public link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <hr />
      <h3>International audience and sharing results</h3>
      <div className="inline wrap spaced">
        <Field label="Audience report period">
          <select
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setReport(null);
            }}
            disabled={action.busy}
          >
            <option value="7">Last 7 completed days</option>
            <option value="28">Last 28 completed days</option>
            <option value="90">Last 90 completed days</option>
          </select>
        </Field>
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () =>
              setReport(
                await post<GrowthReport>("/growth/reports", {
                  days: Number(days),
                }),
              ),
            )
          }
        >
          <RefreshCw size={15} />
          {action.busy ? "Working…" : "Read audience and search queries"}
        </button>
      </div>
      <p className="small subtle">
        Uses your connected GA4 and Search Console access. Reports are reused
        for five minutes. GA4 shows attributed sessions after processing; a
        shared-link click is not necessarily a measured visit.
      </p>
      {report && (
        <>
          <p className="small">
            Read: {formatDate(report.generatedAt, true)} · Analytics:{" "}
            {report.gaRange.start} to {report.gaRange.end} ({report.gaTimeZone})
          </p>
          <p className="small subtle">{report.note}</p>
          <div className="growth-report-grid">
            {report.audience.map((group) => (
              <section className="growth-channel" key={group.dimension}>
                <h3>{labels[group.dimension]}</h3>
                {group.note && (
                  <Notice tone={group.status === "ERROR" ? "warning" : "info"}>
                    {group.note}
                  </Notice>
                )}
                {!group.rows.length ? (
                  <p className="subtle">
                    {group.status === "EMPTY"
                      ? "Google returned no rows for this period. This does not confirm zero traffic."
                      : "No report rows available."}
                  </p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {group.dimension === "sessionCampaignName"
                              ? "Campaign"
                              : "Name"}
                          </th>
                          <th>Sessions</th>
                          <th>Engaged sessions</th>
                          <th>Engagement</th>
                          <th>Pageviews</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, i) => (
                          <tr key={row.label + i}>
                            <td className="break-url">{row.label}</td>
                            <td>{row.sessions.toLocaleString()}</td>
                            <td>{row.engagedSessions.toLocaleString()}</td>
                            <td>{(row.engagementRate * 100).toFixed(1)}%</td>
                            <td>{row.pageviews.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
          <h3>Search-led content opportunities</h3>
          <p className="small subtle">
            Search Console: {report.searchRange.start} to{" "}
            {report.searchRange.end}, Pacific dates. Suggestions use returned
            query/page rows, not invented keyword demand.
          </p>
          {report.queries.note && (
            <Notice
              tone={report.queries.status === "ERROR" ? "warning" : "info"}
            >
              {report.queries.note}
            </Notice>
          )}
          {!report.queries.rows.length ? (
            <p>
              No query opportunities were returned. Continue improving and
              sharing your existing useful articles.
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Query and existing page</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>CTR / position</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.queries.rows.map((q) => (
                    <tr key={q.query + q.url}>
                      <td>
                        <strong>{q.query}</strong>
                        <p>
                          <a
                            href={q.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-url"
                          >
                            Existing article <ExternalLink size={12} />
                          </a>
                        </p>
                      </td>
                      <td>{q.impressions.toLocaleString()}</td>
                      <td>{q.clicks.toLocaleString()}</td>
                      <td>
                        {(q.ctr * 100).toFixed(1)}% / {q.position.toFixed(1)}
                      </td>
                      <td>
                        <p>{q.action}</p>
                        {briefs[q.query + q.url] ? (
                          <Link href={`/articles/${briefs[q.query + q.url]}`}>
                            Open research brief
                          </Link>
                        ) : (
                          <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(async () => {
                                const result = await post<{
                                  id: string;
                                  created: boolean;
                                }>("/growth/research-briefs", {
                                  query: q.query,
                                  url: q.url,
                                });
                                setBriefs((b) => ({
                                  ...b,
                                  [q.query + q.url]: result.id,
                                }));
                                notify(
                                  result.created
                                    ? "Research brief added to Topic planner. Add primary sources before drafting."
                                    : "This research brief already exists.",
                                );
                              })
                            }
                          >
                            Save research brief
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
