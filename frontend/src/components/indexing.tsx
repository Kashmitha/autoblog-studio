"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Plug } from "lucide-react";
import { api, post } from "@/lib/api";
import { Article, IndexingConfiguration, IndexingReport } from "@/lib/types";
import { useAction, useResource } from "./hooks";
import { Badge, Field, Notice } from "./ui";
import type { Notify } from "./studio";

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
                <dd>
                  {s.pageFetchState?.replaceAll("_", " ") || "Not reported"}
                </dd>
                <dt>Indexing permission</dt>
                <dd>
                  {s.indexingState?.replaceAll("_", " ") || "Not reported"}
                </dd>
                <dt>Crawled as</dt>
                <dd>{s.crawledAs || "Not reported"}</dd>
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
              Last check attempted: {date(d.lastAttempt.checkedAt)} · Sri Lanka
              time. This is separate from Google's crawl time.
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
  );
}

export function IndexingOverview({ notify }: { notify: Notify }) {
  const r = useResource<{
      configuration: IndexingConfiguration;
      articles: IndexingReport[];
    }>("/seo/indexing"),
    a = useAction(notify);
  return (
    <section className="panel padded spaced">
      <div className="panel-heading">
        <h2>Publishing and Google indexing</h2>
        <Link className="text-link" href="/connections">
          Configure Search Console
        </Link>
      </div>
      <p className="subtle small">
        Publishing puts a post on your blog. Indexing is Google's separate
        decision. Refresh reads the stored report; it does not request another
        crawl.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.data && !r.data.articles.length && (
        <p className="subtle">
          Published and scheduled articles will appear here.
        </p>
      )}
      {r.data?.articles.map((item) => (
        <div className="indexing-row" key={item.articleId}>
          <div>
            <Link href={"/articles/" + item.articleId}>
              <strong>{item.title}</strong>
            </Link>
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
          </div>
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
        </div>
      ))}
    </section>
  );
}
