"use client";
import { useEffect } from "react";
import { ArrowDownToLine, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { post } from "@/lib/api";
import { FetchDiagnosticReport } from "@/lib/types";
import type { Notify } from "./studio";
import { useResource, useAction } from "./hooks";
import { Notice } from "./ui";
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not reported";
const outcome = (value?: string) =>
  ({
    NO_ISSUE_REPRODUCED: "No issue reproduced in these requests",
    ISSUE_OBSERVED: "A fetch issue was observed",
    REVIEW_NEEDED: "Fetch findings need review",
    INCONCLUSIVE: "The check was inconclusive",
  })[value || ""] || "No completed diagnostic";
export function FetchDiagnostics({
  id,
  notify,
}: {
  id: string;
  notify: Notify;
}) {
  const r = useResource<FetchDiagnosticReport>(
      "/seo/articles/" + id + "/fetch-diagnostics",
    ),
    a = useAction(notify),
    d = r.data,
    run = d?.latest,
    result = run?.result;
  const running =
    run?.state === "RUNNING" &&
    Date.now() - new Date(run.startedAt).getTime() < 120000;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void r.reload(), 3000);
    return () => clearInterval(timer);
  }, [running, r.reload]);
  return (
    <section
      className="panel padded spaced"
      aria-label="Live fetch diagnostics"
    >
      <h2>Live fetch diagnostics</h2>
      <p className="small subtle">
        Check the published page’s desktop/mobile HTTP redirects and metadata.
        This is a Studio check, separate from Google’s stored report and Test
        Live URL.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {d && (
        <>
          <p className="small">
            <strong>{d.article.title}</strong>
          </p>
          <p className="small break-url">{d.article.publishedUrl}</p>
          {d.blockedReason && <Notice>{d.blockedReason}</Notice>}
          <div className="inline wrap spaced">
            <button
              className="secondary"
              disabled={a.busy || !d.canCheck || running}
              onClick={() =>
                a.run(async () => {
                  const next = await post<FetchDiagnosticReport>(
                    "/seo/articles/" + id + "/fetch-diagnostics/run",
                  );
                  r.setData(next);
                  notify(
                    next.latest?.state === "FAILED"
                      ? next.latest.errorMessage ||
                          "The check could not complete."
                      : next.cached
                        ? "Recent diagnostic reused; live fetches are spaced 15 minutes apart."
                        : "Live fetch diagnostic saved. This does not confirm indexing.",
                    next.latest?.state === "FAILED",
                  );
                })
              }
            >
              <RefreshCw size={14} />
              {a.busy || running
                ? "Checking live redirects…"
                : "Check live redirects"}
            </button>
            {result && (
              <a
                className="text-link small"
                href={"/api/seo/articles/" + id + "/fetch-diagnostics/export"}
                download
              >
                <ArrowDownToLine size={13} />
                Download diagnostic report
              </a>
            )}
          </div>
          {run?.state === "FAILED" && (
            <Notice tone="warning">{run.errorMessage}</Notice>
          )}
          {result && (
            <>
              <p>
                <strong>{outcome(result.outcome)}</strong>
              </p>
              <p className="small subtle">
                Studio checked: {date(result.checkedAt)} · Sri Lanka time.
              </p>
              <Notice
                tone={result.outcome === "ISSUE_OBSERVED" ? "warning" : "info"}
              >
                {result.limitation}
              </Notice>
              {result.profiles.map((profile) => (
                <details className="diagnostic-profile" key={profile.name}>
                  <summary>
                    {profile.name} ·{" "}
                    {profile.status === null
                      ? "No HTTP result"
                      : "HTTP " + profile.status}{" "}
                    · {Math.max(0, profile.hops.length - 1)} followed
                    redirect(s)
                  </summary>
                  {profile.error && (
                    <p className="small warning-text">{profile.error}</p>
                  )}
                  {profile.findings.map((f, i) => (
                    <p
                      className={
                        "small " +
                        (f.severity === "issue" ? "warning-text" : "subtle")
                      }
                      key={f.code + i}
                    >
                      {f.message}
                    </p>
                  ))}
                  <ol className="diagnostic-chain">
                    {profile.hops.map((hop, i) => (
                      <li key={hop.url + i}>
                        <strong>HTTP {hop.status}</strong>
                        <p className="small break-url">{hop.url}</p>
                        {hop.location && (
                          <p className="small break-url">
                            Destination: {hop.location}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  {profile.metadata && (
                    <dl className="indexing-details">
                      <dt>Declared canonical</dt>
                      <dd className="break-url">
                        {profile.metadata.canonicals.join(" · ") ||
                          "Not found in this HTML"}
                      </dd>
                      <dt>Google noindex directive</dt>
                      <dd>
                        {profile.metadata.noindex
                          ? "Detected"
                          : "Not detected in fetched HTML/headers"}
                      </dd>
                      <dt>Robots directives</dt>
                      <dd className="break-url">
                        {profile.metadata.robots
                          .map((meta) => meta.agent + ": " + meta.content)
                          .join(" · ") || "None found in fetched HTML/headers"}
                      </dd>
                      <dt>Refresh instructions</dt>
                      <dd className="break-url">
                        {[
                          profile.metadata.refreshHeader,
                          ...profile.metadata.metaRefresh,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "None found"}
                      </dd>
                    </dl>
                  )}
                </details>
              ))}
            </>
          )}
          {d.google && (
            <p className="small subtle">
              Google’s saved result:{" "}
              <strong>{d.google.coverageState || d.google.state}</strong>.
              Recorded crawl: {date(d.google.lastCrawlTime)}. Report received:{" "}
              {date(d.google.checkedAt)}. These are separate from Studio’s live
              fetch time.
            </p>
          )}
          <details className="spaced">
            <summary>Next step in Google Search Console</summary>
            <ol className="help-list">
              <li>
                Copy this exact article URL into Google’s URL Inspection bar.
              </li>
              <li>
                Choose <strong>TEST LIVE URL</strong>, then expand{" "}
                <strong>Page availability</strong>.
              </li>
              <li>
                Compare <strong>Page fetch</strong> and the test time with the
                recorded failed crawl. If it fails, inspect{" "}
                <strong>View tested page → More info</strong> when available.
              </li>
            </ol>
            <div className="inline wrap">
              <button
                className="secondary compact"
                onClick={() =>
                  a.run(async () => {
                    await navigator.clipboard.writeText(
                      d.article.publishedUrl!,
                    );
                  }, "Article URL copied.")
                }
                disabled={!d.article.publishedUrl || a.busy}
              >
                <Copy size={13} />
                Copy article URL
              </button>
              <a
                className="text-link small"
                href={
                  d.google?.inspectionResultLink ||
                  "https://search.google.com/search-console/"
                }
                target="_blank"
                rel="noreferrer"
              >
                Open Google URL Inspection <ExternalLink size={13} />
              </a>
            </div>
            <p className="small subtle">
              A successful live test still does not confirm indexing. This
              diagnostic does not change the Blogger theme, redirects, ads or
              article.
            </p>
          </details>
          {d.history.length > 1 && (
            <details className="spaced">
              <summary>Recent live diagnostics ({d.history.length})</summary>
              {d.history.map((h) => (
                <p className="small" key={h.id}>
                  {date(h.startedAt)} ·{" "}
                  {h.state === "COMPLETED"
                    ? outcome(h.result?.outcome)
                    : h.state === "RUNNING"
                      ? "In progress"
                      : "Check failed"}
                </p>
              ))}
            </details>
          )}
          {d.nextCheckAt && (
            <p className="small subtle">
              Next fresh check available: {date(d.nextCheckAt)}. Saved reports
              remain available between checks.
            </p>
          )}
        </>
      )}
    </section>
  );
}
