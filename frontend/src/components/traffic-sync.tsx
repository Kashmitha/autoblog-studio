"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { post } from "@/lib/api";
import { TrafficSyncStatus, TrafficSyncAttempt } from "@/lib/types";
import type { Notify } from "./studio";
import { useAction, useResource } from "./hooks";
import { Notice } from "./ui";
const when = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not yet";
const label = (attempt: TrafficSyncAttempt) =>
  ({
    RUNNING: "Import in progress",
    SUCCEEDED: "Search rows imported",
    EMPTY: "Connected · Google returned no rows",
    FAILED: "Import failed",
  })[attempt.state];
export function TrafficSync({ notify }: { notify: Notify }) {
  const r = useResource<TrafficSyncStatus>("/reports/search-console/status"),
    a = useAction(notify),
    d = r.data;
  const wasRunning = useRef(false);
  const running = d?.lastAttempt?.state === "RUNNING";
  const leaseActive =
    running &&
    Date.now() - new Date(d!.lastAttempt!.startedAt).getTime() < 15 * 60000;
  useEffect(() => {
    if (wasRunning.current && !running)
      window.dispatchEvent(new Event("traffic-records-changed"));
    wasRunning.current = running;
    if (!leaseActive) return;
    const timer = window.setInterval(() => void r.reload(), 5000);
    return () => clearInterval(timer);
  }, [running, leaseActive, r.reload]);
  return (
    <section
      className="panel padded spaced"
      aria-label="Search traffic imports"
    >
      <div className="panel-heading">
        <h2>Search traffic imports</h2>
        <button
          className="secondary"
          disabled={
            a.busy ||
            !d?.configuration.configured ||
            !d.configuration.readAccess ||
            leaseActive
          }
          onClick={() =>
            a.run(async () => {
              const result = await post<{
                sync: TrafficSyncAttempt | null;
                note: string;
              }>("/reports/search-console/refresh-due");
              window.dispatchEvent(new Event("traffic-records-changed"));
              await r.reload();
              notify(result.note, result.sync?.state === "FAILED");
            })
          }
        >
          <RefreshCw size={14} />
          Sync search traffic when due
        </button>
      </div>
      <p className="subtle">
        Studio imports search clicks and impressions once a day while open. The
        first automatic import covers 56 completed days; later imports revisit
        the latest 7 days as Google updates its reports.
      </p>
      <p className="small subtle">
        Imports pause when Studio is closed and resume on your next visit. This
        does not publish posts or request indexing. Pageviews need Analytics or
        actual traffic records.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {d && (
        <>
          {!d.configuration.configured || !d.configuration.readAccess ? (
            <Notice>
              <Link href="/connections">
                Connect Search Console read access
              </Link>{" "}
              to enable imports.
            </Notice>
          ) : (
            <>
              <p className="small break-url">
                Property: <strong>{d.configuration.siteUrl}</strong>
              </p>
              {d.lastAttempt ? (
                <>
                  <p>
                    <strong>{label(d.lastAttempt)}</strong>
                  </p>
                  {d.lastAttempt.state === "FAILED" && (
                    <Notice tone="warning">
                      {d.lastAttempt.errorMessage} Previous saved reports are
                      retained.
                    </Notice>
                  )}
                  {d.lastAttempt.state === "EMPTY" && (
                    <Notice>
                      Google returned no rows for this range. This confirms a
                      successful read, not zero traffic or completed indexing.
                    </Notice>
                  )}
                  <dl className="indexing-details">
                    <dt>Last import attempt</dt>
                    <dd>{when(d.lastAttempt.startedAt)}</dd>
                    <dt>Requested dates</dt>
                    <dd>
                      {d.lastAttempt.startDate.slice(0, 10)} to{" "}
                      {d.lastAttempt.endDate.slice(0, 10)} · Pacific dates
                    </dd>
                    <dt>Rows saved</dt>
                    <dd>
                      {d.lastAttempt.state === "RUNNING" ||
                      d.lastAttempt.state === "FAILED"
                        ? "No completed import"
                        : d.lastAttempt.imported}
                    </dd>
                    <dt>Last successful read</dt>
                    <dd>{when(d.lastSuccess?.finishedAt)}</dd>
                    <dt>Next automatic check</dt>
                    <dd>
                      {d.nextAutomaticSyncAt
                        ? when(d.nextAutomaticSyncAt) + " or next Studio visit"
                        : "When Studio is open"}
                    </dd>
                  </dl>
                </>
              ) : (
                <p className="small subtle">
                  No tracked import yet. Studio will check while open. Earlier
                  traffic records, if any, remain available.
                </p>
              )}
            </>
          )}
          {!!d.history.length && (
            <details className="spaced">
              <summary>Traffic import history ({d.history.length})</summary>
              <div className="stack-list">
                {d.history.map((h) => (
                  <div className="list-row" key={h.id}>
                    <div>
                      <strong>{label(h)}</strong>
                      <p className="small subtle">
                        {when(h.startedAt)} ·{" "}
                        {h.trigger === "automatic" ? "Automatic" : "Manual"} ·{" "}
                        {h.startDate.slice(0, 10)} to {h.endDate.slice(0, 10)}
                      </p>
                      {h.state === "SUCCEEDED" && (
                        <p className="small">{h.imported} row(s) saved.</p>
                      )}
                      {h.errorMessage && (
                        <p className="small warning-text">{h.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <p className="small subtle">
            All times use Sri Lanka time; report dates use Google Pacific Time.
            Failed automatic reads wait at least one hour before retrying. Use
            the date controls below for a custom import.
          </p>
        </>
      )}
    </section>
  );
}
