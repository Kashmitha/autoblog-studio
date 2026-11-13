"use client";
import Link from "next/link";
import { useResource } from "./hooks";
import { formatDate } from "@/lib/api";
import { adReportMoney } from "@/lib/adsterra-report";
import { Notice } from "./ui";

type Attempt = {
  state: string;
  startDate: string;
  endDate: string;
  imported: number;
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
};
export type WeeklyReviewData = {
  generatedAt: string;
  window: { startDate: string; endDate: string; timezone: string };
  publishing: {
    published: number;
    needsReview: number;
    approved: number;
    pastSchedules: number;
    paused: boolean | null;
    emergencyStop: boolean | null;
    scheduled: {
      id: string;
      title: string;
      scheduledAt: string;
      publishingTarget: string;
      remoteStatus: string | null;
    }[];
  };
  search: {
    siteUrl: string | null;
    lastAttempt: Attempt | null;
    lastSuccess: Attempt | null;
  };
  adReport: null | {
    id: string;
    filename: string;
    scopeLabel: string;
    timezoneLabel: string;
    savedAt: string;
    summary: null | {
      startDate: string;
      endDate: string;
      reportedDates: number;
      impressions: number;
      clicks: number;
      revenue: number;
    };
  };
  actions: { label: string; href: string }[];
};

export function WeeklyReview() {
  const r = useResource<WeeklyReviewData>("/dashboard/weekly-review"),
    data = r.error ? null : r.data;
  const attempt = data?.search.lastAttempt;
  const success = data?.search.lastSuccess;
  return (
    <section className="panel padded spaced" aria-label="Weekly review">
      <div className="inline spread">
        <h2>Weekly review</h2>
        <button
          className="secondary"
          disabled={r.loading}
          onClick={() => void r.reload()}
        >
          Refresh summary
        </button>
      </div>
      <p className="subtle small">
        Saved records only. Refreshing this summary does not import traffic,
        request indexing, publish posts or change automation.
      </p>
      {r.error && (
        <div role="alert">
          <Notice tone="warning">
            Could not load the weekly review. {r.error}
          </Notice>
        </div>
      )}
      {r.loading && <p className="subtle small">Loading weekly review…</p>}
      {data && (
        <>
          <p className="subtle small">
            Publishing window: {data.window.startDate} to {data.window.endDate}{" "}
            · seven completed days · {data.window.timezone}. Read at{" "}
            {formatDate(data.generatedAt, true)}.
          </p>
          <div className="weekly-review-grid">
            <div>
              <h3>Workspace publishing</h3>
              <p>{data.publishing.published} published during this window.</p>
              <p className="subtle small">
                Current queue: {data.publishing.needsReview} needs review ·{" "}
                {data.publishing.approved} approved. These queue counts are not
                limited to the publishing window.
              </p>
              <p className="subtle small">
                Local automation:{" "}
                {data.publishing.emergencyStop
                  ? "Emergency stop enabled"
                  : data.publishing.paused === null
                    ? "Status unavailable"
                    : data.publishing.paused
                      ? "Paused"
                      : "Resumed"}
                . Confirmed Blogger-held schedules run independently of this
                computer.
              </p>
              {data.publishing.pastSchedules > 0 && (
                <Notice tone="warning">
                  {data.publishing.pastSchedules} past schedules await status
                  confirmation. This is not proof of publication or failure.
                </Notice>
              )}
              <h4>Next saved schedules</h4>
              {data.publishing.scheduled.length ? (
                <ul>
                  {data.publishing.scheduled.map((article) => (
                    <li key={article.id}>
                      <Link
                        className="text-link"
                        href={"/articles/" + article.id}
                      >
                        {article.title}
                      </Link>
                      <div className="small subtle">
                        {formatDate(article.scheduledAt, true)} · Asia/Colombo ·{" "}
                        {article.publishingTarget === "blogger"
                          ? "Blogger-held"
                          : "Local worker; this computer must be running"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="subtle small">No future schedules saved.</p>
              )}
            </div>
            <div>
              <h3>Latest saved search import</h3>
              <p className="small break-url">
                Property: {data.search.siteUrl || "Not selected"}
              </p>
              {attempt ? (
                <>
                  <p>
                    <strong>
                      {attempt.state === "EMPTY"
                        ? "Google returned no rows"
                        : attempt.state === "FAILED"
                          ? "Last import failed"
                          : attempt.state === "RUNNING"
                            ? "Import was recorded as running"
                            : "Last import succeeded"}
                    </strong>
                  </p>
                  <p className="subtle small">
                    Requested dates: {attempt.startDate} to {attempt.endDate} ·
                    Pacific dates. Last attempt:{" "}
                    {formatDate(attempt.startedAt, true)} Sri Lanka time.
                  </p>
                  {attempt.state === "EMPTY" ? (
                    <p className="subtle small">
                      A successful empty read does not confirm zero traffic or
                      indexing.
                    </p>
                  ) : attempt.state === "SUCCEEDED" ? (
                    <p className="subtle small">
                      {attempt.imported} rows saved. Row count is not a count of
                      visitors, impressions or clicks.
                    </p>
                  ) : (
                    <p className="subtle small">
                      {attempt.errorCode
                        ? `Reason: ${attempt.errorCode}. `
                        : ""}
                      Existing successful reads are retained.
                    </p>
                  )}
                </>
              ) : (
                <p className="subtle small">
                  No saved import for this property.
                </p>
              )}
              {success && attempt?.startedAt !== success.startedAt && (
                <p className="subtle small">
                  Previous successful read:{" "}
                  {formatDate(success.finishedAt || success.startedAt, true)} ·{" "}
                  {success.startDate} to {success.endDate} Pacific dates ·{" "}
                  {success.state === "EMPTY"
                    ? "No rows returned"
                    : `${success.imported} rows saved`}
                  .
                </p>
              )}
            </div>
            <div>
              <h3>Latest saved ad snapshot</h3>
              {data.adReport ? (
                <>
                  <p className="small break-url">
                    {data.adReport.filename} · saved{" "}
                    {formatDate(data.adReport.savedAt, true)}.
                  </p>
                  <p className="subtle small">
                    Domain filter: {data.adReport.scopeLabel || "Unknown"}.
                    Timezone: {data.adReport.timezoneLabel || "Unknown"}.
                    Owner-entered labels are not verified.
                  </p>
                  {data.adReport.summary ? (
                    <>
                      <p className="subtle small">
                        Report dates: {data.adReport.summary.startDate} to{" "}
                        {data.adReport.summary.endDate} ·{" "}
                        {data.adReport.summary.reportedDates} reported dates.
                        This is the report's own range, not the publishing week.
                      </p>
                      <p>
                        {data.adReport.summary.impressions.toLocaleString(
                          "en-US",
                        )}{" "}
                        ad impressions ·{" "}
                        {data.adReport.summary.clicks.toLocaleString("en-US")}{" "}
                        ad clicks ·{" "}
                        {adReportMoney(data.adReport.summary.revenue)} exported
                        revenue.
                      </p>
                    </>
                  ) : (
                    <p className="subtle small">
                      Snapshot summary is unavailable. Open Monetization to
                      inspect the saved report.
                    </p>
                  )}
                  <p className="subtle small">
                    Ad impressions are not visitors. Exported revenue may be
                    rounded or revised and is not proof of payment.
                  </p>
                </>
              ) : (
                <p className="subtle small">
                  No saved ad report. Earnings are unavailable from this source.
                </p>
              )}
            </div>
          </div>
          <h3>Next actions</h3>
          <ul>
            {data.actions.map((action) => (
              <li key={action.href + action.label}>
                <Link className="text-link" href={action.href}>
                  {action.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
