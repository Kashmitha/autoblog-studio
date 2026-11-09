"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Plug } from "lucide-react";
import { api, post } from "@/lib/api";
import { Article, IndexingConfiguration, IndexingReport } from "@/lib/types";
import { useAction, useResource } from "./hooks";
import { Badge, Field, Notice } from "./ui";
import type { Notify } from "./studio";
import { FetchDiagnostics } from "./fetch-diagnostics";

const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not reported by Google";
const state = (report: IndexingReport) =>
  !report.eligible
    ? "NOT_PUBLISHED"
    : report.latest?.state ||
      (report.lastAttempt?.state === "ERROR" ? "UNAVAILABLE" : "NOT_CHECKED");
const reported = (value: string | null | undefined) => {
  if (!value || value.endsWith("_UNSPECIFIED")) return "Not reported by Google";
  return (
    (
      {
        SUCCESSFUL: "Successful",
        REDIRECT_ERROR: "Redirect error",
        INDEXING_ALLOWED: "Allowed",
        BLOCKED_BY_META_TAG: "Blocked by page settings",
        BLOCKED_BY_HTTP_HEADER: "Blocked by response headers",
        MOBILE: "Smartphone",
        DESKTOP: "Desktop",
      } as Record<string, string>
    )[value] || value.toLowerCase().replaceAll("_", " ")
  );
};
const category = (item: IndexingReport) =>
  !item.eligible
    ? "scheduled"
    : item.lastAttempt?.state === "ERROR" || !item.canInspect
      ? "attention"
      : item.followUp?.category ||
        (item.latest?.state === "INDEXED" ? "indexed" : "unknown");
function FollowUp({ report }: { report: IndexingReport }) {
  return report.followUp ? (
    <div className="indexing-follow-up">
      <strong>{report.followUp.title}</strong>
      <p className="small">{report.followUp.action}</p>
      {report.followUp.sameCrawl && (
        <p className="small subtle">
          Same recorded crawl as the previous report. Refreshing did not trigger
          a new Google crawl.
        </p>
      )}
    </div>
  ) : null;
}
function feedback(result: IndexingReport, notify: Notify) {
  if (result.lastAttempt?.state === "ERROR")
    notify(
      result.lastAttempt.errorMessage ||
        "Google could not return a result. Previous data is retained.",
      true,
    );
  else
    notify(
      result.cached
        ? "Recent saved result shown. Checks are spaced five minutes apart."
        : "Google's stored index report refreshed.",
    );
}

export function SearchConsoleConnection({ notify }: { notify: Notify }) {
  const r = useResource<IndexingConfiguration>("/seo/search-console"),
    a = useAction(notify);
  const [properties, setProperties] = useState<
      { siteUrl: string; permissionLevel: string }[]
    >([]),
    [loaded, setLoaded] = useState(false),
    [site, setSite] = useState("");
  return (
    <section
      className="panel padded spaced"
      aria-label="Search Console connection"
    >
      <div className="panel-heading">
        <h2>Search Console connection</h2>
        <Badge
          value={
            r.data?.configured && r.data?.readAccess
              ? "CONFIGURED"
              : "SETUP_NEEDED"
          }
        />
      </div>
      <p className="subtle">
        Read Google's stored indexing results, clicks and impressions. This does
        not change your Blogger schedules or request indexing.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.data && (
        <>
          <p className="small">
            Selected property:{" "}
            <strong className="break-url">
              {r.data.siteUrl || "Not selected"}
            </strong>
          </p>
          <p className="small">
            Google read access:{" "}
            <strong>{r.data.readAccess ? "Granted" : "Not connected"}</strong>
          </p>
          <Notice>
            Use your existing Google Cloud project. Enable{" "}
            <a
              href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com"
              target="_blank"
              rel="noreferrer"
            >
              Search Console API
            </a>
            , connect read access with the same Google account as Blogger, then
            load and select your verified property. No new Blogger client or
            project is needed.
          </Notice>
          <div className="inline wrap spaced">
            <button
              className="secondary"
              disabled={
                a.busy || !r.data.googleConfigured || !r.data.googleConnected
              }
              onClick={() =>
                a.run(async () => {
                  const result = await api<{ url: string }>(
                    "/integrations/google/connect?searchConsole=true",
                  );
                  window.location.href = result.url;
                })
              }
            >
              <Plug size={15} />
              Connect Search Console read access
            </button>
            <button
              className="secondary"
              disabled={a.busy || !r.data.readAccess}
              onClick={() =>
                a.run(async () => {
                  const list = await api<
                    { siteUrl: string; permissionLevel: string }[]
                  >("/seo/search-console/properties");
                  setProperties(list);
                  setLoaded(true);
                  setSite(
                    list.find((p) => p.siteUrl === r.data?.siteUrl)?.siteUrl ||
                      (list.length === 1 ? list[0].siteUrl : ""),
                  );
                })
              }
            >
              Load verified properties
            </button>
          </div>
          {loaded &&
            (!properties.length ? (
              <Notice>
                No verified HTTPS or domain property was returned for this
                account. Check property access in Search Console.
              </Notice>
            ) : (
              <>
                <Field label="Verified Search Console property">
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  >
                    <option value="">Choose verified property</option>
                    {properties.map((p) => (
                      <option key={p.siteUrl} value={p.siteUrl}>
                        {p.siteUrl}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  className="primary"
                  disabled={a.busy || !site}
                  onClick={() =>
                    a.run(async () => {
                      const result = await post<IndexingConfiguration>(
                        "/seo/search-console/property",
                        { siteUrl: site },
                      );
                      r.setData(result);
                      window.dispatchEvent(
                        new Event("reporting-config-changed"),
                      );
                    }, "Verified Search Console property saved.")
                  }
                >
                  Use this property
                </button>
              </>
            ))}
          <p className="small subtle spaced">
            Configuring the connection does not confirm that any page is
            indexed. An API or permission error will be shown when a read fails.
          </p>
        </>
      )}
    </section>
  );
}

export function ArticleIndexing({
  article,
  notify,
}: {
  article: Article;
  notify: Notify;
}) {
  if (article.status !== "PUBLISHED")
    return ["SCHEDULED", "PUBLISHING"].includes(article.status) ? (
      <section className="panel padded spaced" aria-label="Google indexing">
        <h2>Google indexing</h2>
        <Badge value="NOT_PUBLISHED" />
        <p className="subtle small">
          Blogger publishing and Google indexing are separate. Check indexing
          after Blogger confirms this post is published.
        </p>
      </section>
    ) : null;
  return <PublishedIndexing id={article.id} notify={notify} />;
}
function PublishedIndexing({ id, notify }: { id: string; notify: Notify }) {
  const r = useResource<IndexingReport>("/seo/articles/" + id + "/indexing"),
    a = useAction(notify);
  const d = r.data,
    s = d?.latest;
  return (
    <>
      <section className="panel padded spaced" aria-label="Google indexing">
        <div className="panel-heading">
          <h2>Google indexing</h2>
          {d && <Badge value={state(d)} />}
        </div>
        <p className="subtle small">
          Google's stored index report, separate from publishing. This is not a
          live URL test and cannot force indexing.
        </p>
        {r.error && <Notice tone="warning">{r.error}</Notice>}
        {d && (
          <>
            <p className="small">
              <strong>{d.title}</strong>
            </p>
            {d.url && (
              <a
                className="text-link small break-url"
                href={d.url}
                target="_blank"
                rel="noreferrer"
              >
                {d.url} <ExternalLink size={13} />
              </a>
            )}
            <FollowUp report={d} />
            {d.blockedReason && (
              <Notice>
                {d.blockedReason}{" "}
                <Link href="/connections">Open Blog connections</Link>
              </Notice>
            )}
            {d.lastAttempt?.state === "ERROR" && (
              <Notice tone="warning">
                {d.lastAttempt.errorMessage}{" "}
                {s
                  ? "The last confirmed result below is retained."
                  : "No indexing conclusion is available yet."}
              </Notice>
            )}
            {s ? (
              <>
                <p>
                  <strong>
                    {s.coverageState ||
                      "Google did not return a coverage description."}
                  </strong>
                </p>
                <dl className="indexing-details">
                  <dt>Last result received</dt>
                  <dd>{date(s.checkedAt)}</dd>
                  <dt>Google's last crawl</dt>
                  <dd>{date(s.lastCrawlTime)}</dd>
                  <dt>Page fetch</dt>
                  <dd>{reported(s.pageFetchState)}</dd>
                  <dt>Indexing permission</dt>
                  <dd>{reported(s.indexingState)}</dd>
                  <dt>Crawled as</dt>
                  <dd>{reported(s.crawledAs)}</dd>
                  <dt>Google-selected canonical</dt>
                  <dd className="break-url">
                    {s.googleCanonical || "Not reported"}
                  </dd>
                  <dt>Declared canonical</dt>
                  <dd className="break-url">
                    {s.userCanonical || "Not reported"}
                  </dd>
                </dl>
              </>
            ) : (
              <p className="subtle">No saved Google indexing result yet.</p>
            )}
            {d.lastAttempt && (
              <p className="small subtle">
                Last check attempted: {date(d.lastAttempt.checkedAt)} · Sri
                Lanka time. This is separate from Google's crawl time.
              </p>
            )}
            {d.canInspect && (
              <p className="small subtle">
                Next daily report check:{" "}
                {d.nextAutomaticCheckAt
                  ? date(d.nextAutomaticCheckAt) +
                    " or when Studio is next open"
                  : "when Studio is open"}
                . This checks status; it does not submit an indexing request.
              </p>
            )}
            <div className="inline wrap">
              <button
                className="secondary"
                disabled={a.busy || !d.canInspect}
                onClick={() =>
                  a.run(async () => {
                    const result = await post<IndexingReport>(
                      "/seo/articles/" + id + "/inspect",
                    );
                    r.setData(result);
                    feedback(result, notify);
                  })
                }
              >
                <RefreshCw size={14} />
                Refresh indexing status
              </button>
              <a
                className="text-link"
                href={
                  s?.inspectionResultLink ||
                  "https://search.google.com/search-console/"
                }
                target="_blank"
                rel="noreferrer"
              >
                Open Search Console <ExternalLink size={14} />
              </a>
            </div>
            {d.history.length > 0 && (
              <details className="spaced">
                <summary>Inspection history ({d.history.length})</summary>
                <div className="stack-list">
                  {d.history.map((h) => (
                    <div className="list-row" key={h.id}>
                      <div>
                        <strong>
                          {h.state === "ERROR"
                            ? "Check failed"
                            : h.coverageState || h.state.replaceAll("_", " ")}
                        </strong>
                        <p className="small subtle">
                          Checked {date(h.checkedAt)} · Google crawl{" "}
                          {date(h.lastCrawlTime)}
                        </p>
                        {h.errorMessage && (
                          <p className="small warning-text">{h.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>
      <FetchDiagnostics id={id} notify={notify} />
    </>
  );
}

export function IndexingOverview({
  notify,
  compact = false,
}: {
  notify: Notify;
  compact?: boolean;
}) {
  const r = useResource<{
      configuration: IndexingConfiguration;
      articles: IndexingReport[];
    }>("/seo/indexing"),
    a = useAction(notify);
  const [filter, setFilter] = useState("all");
  const articles = r.data?.articles || [];
  const attention = articles.filter((item) => category(item) === "attention");
  const visible = compact
    ? attention.slice(0, 3)
    : articles.filter((item) => filter === "all" || category(item) === filter);
  return (
    <section className="panel padded spaced" aria-label="Publishing follow-up">
      <div className="panel-heading">
        <h2>
          {compact ? "Publishing follow-up" : "Publishing and Google indexing"}
        </h2>
        <Link className="text-link" href="/connections">
          Configure Search Console
        </Link>
      </div>
      <p className="subtle small">
        Studio checks due Google reports automatically while open, once every 24
        hours per published article. Blogger publishes your scheduled posts even
        when this computer is off. Manual indexing requests are optional.
      </p>
      <p className="small subtle">
        These are stored reports, not live URL tests. Checks pause when Studio
        is closed and resume when you open it. Failed reads wait at least one
        hour before an automatic retry.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.data && (
        <>
          <dl className="indexing-summary">
            <div>
              <dt>Published</dt>
              <dd>{articles.filter((i) => i.eligible).length}</dd>
            </div>
            <div>
              <dt>Indexing confirmed</dt>
              <dd>
                {
                  articles.filter(
                    (i) => i.latest?.state === "INDEXED" && i.eligible,
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Waiting for Google</dt>
              <dd>
                {articles.filter((i) => category(i) === "waiting").length}
              </dd>
            </div>
            <div>
              <dt>Needs attention</dt>
              <dd>{attention.length}</dd>
            </div>
          </dl>
          <div className="inline wrap spaced">
            {!compact && (
              <Field label="Show indexing reports">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All articles</option>
                  <option value="attention">Needs attention</option>
                  <option value="waiting">Waiting for Google</option>
                  <option value="indexed">Indexing confirmed</option>
                  <option value="scheduled">Awaiting publication</option>
                  <option value="unknown">Not yet checked</option>
                </select>
              </Field>
            )}
            <button
              className="secondary"
              disabled={
                a.busy ||
                !r.data.configuration.configured ||
                !r.data.configuration.readAccess
              }
              onClick={() =>
                a.run(async () => {
                  const result = await post<{
                    results: { checked: boolean; error?: string }[];
                    remaining: number;
                  }>("/seo/indexing/refresh-due");
                  await r.reload();
                  window.dispatchEvent(new Event("indexing-status-synced"));
                  const failed = result.results.some((i) => i.error);
                  notify(
                    failed
                      ? "Some checks could not complete. Saved results are retained."
                      : `${result.results.filter((i) => i.checked).length} due report(s) checked. ${result.remaining ? "More will be checked while Studio stays open." : "Recent reports are reused until their next daily check."}`,
                    failed,
                  );
                })
              }
            >
              <RefreshCw size={14} />
              Check reports due
            </button>
            {compact && (
              <Link href="/analytics" className="text-link">
                View all indexing reports
              </Link>
            )}
          </div>
        </>
      )}
      {r.data && !r.data.articles.length && (
        <p className="subtle">
          Published and scheduled articles will appear here.
        </p>
      )}
      {r.data && articles.length > 0 && !visible.length && (
        <p className="subtle small">
          {compact
            ? "No indexing problems currently need attention. Waiting and unchecked reports are listed in Traffic & SEO."
            : "No articles match this filter."}
        </p>
      )}
      {visible.map((item) => (
        <div className="indexing-row" key={item.articleId}>
          <div>
            <Link href={"/articles/" + item.articleId}>
              <strong>{item.title}</strong>
            </Link>
            {item.url && item.eligible && (
              <p className="small">
                <a
                  className="text-link break-url"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.url} <ExternalLink size={13} />
                </a>
              </p>
            )}
            <div className="inline wrap spaced">
              <span className="small">Publishing:</span>
              <Badge value={item.publishingStatus} />
              <span className="small">Indexing:</span>
              <Badge value={state(item)} />
            </div>
            <p className="small subtle">
              {!item.eligible
                ? "Check after publication."
                : item.latest?.coverageState ||
                  item.blockedReason ||
                  "No indexing result saved yet."}
            </p>
            {item.latest && (
              <p className="small subtle">
                Last check {date(item.latest.checkedAt)} · Google crawl{" "}
                {date(item.latest.lastCrawlTime)}
              </p>
            )}
            {item.lastAttempt?.state === "ERROR" && (
              <p className="small warning-text">
                {item.lastAttempt.errorMessage}
              </p>
            )}
            <FollowUp report={item} />
            {item.canInspect && (
              <p className="small subtle">
                Next daily check:{" "}
                {item.nextAutomaticCheckAt
                  ? date(item.nextAutomaticCheckAt) + " or next Studio visit"
                  : "when Studio is open"}
                .
              </p>
            )}
          </div>
          {!compact && (
            <button
              className="secondary compact"
              disabled={a.busy || !item.canInspect}
              onClick={() =>
                a.run(async () => {
                  const result = await post<IndexingReport>(
                    "/seo/articles/" + item.articleId + "/inspect",
                  );
                  r.setData((previous) =>
                    previous
                      ? {
                          ...previous,
                          articles: previous.articles.map((p) =>
                            p.articleId === item.articleId ? result : p,
                          ),
                        }
                      : previous,
                  );
                  feedback(result, notify);
                })
              }
            >
              Check indexing
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
