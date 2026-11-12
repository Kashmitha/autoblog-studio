"use client";
import { useRef, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { adReportMoney } from "@/lib/adsterra-report";
import {
  compareAdReports,
  type AdReportSummary,
  type AdReportSnapshot,
} from "@/lib/ad-report-comparison";
import { Field, Notice } from "./ui";

export function AdReportComparison({
  history,
}: {
  history: AdReportSummary[];
}) {
  const [previousId, setPreviousId] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [result, setResult] = useState<{
    previous: AdReportSnapshot;
    current: AdReportSnapshot;
    comparison: ReturnType<typeof compareAdReports>;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const clear = () => {
    ++request.current;
    setResult(null);
    setError("");
    setBusy(false);
  };
  const comparison = result?.comparison;
  return (
    <section aria-label="Compare saved ad reports" className="spaced">
      <h3>Compare saved ad reports</h3>
      <p className="subtle small">
        Compare matching dates and see which dates appear in only one export.
        Matching-date differences are report revisions, not growth between
        different periods.
      </p>
      {history.length < 2 ? (
        <p className="subtle small">
          Save two reports above to compare them here.
        </p>
      ) : (
        <>
          {(["Previous", "Current"] as const).map((side) => (
            <Field key={side} label={`${side} ad report`}>
              <select
                value={side === "Previous" ? previousId : currentId}
                onChange={(event) => {
                  clear();
                  (side === "Previous" ? setPreviousId : setCurrentId)(
                    event.target.value,
                  );
                }}
              >
                <option value="">Choose a saved report</option>
                {history.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.filename} · {formatDate(saved.createdAt, true)} ·{" "}
                    {saved.scopeLabel || "Domain not recorded"}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <button
            className="secondary"
            disabled={
              busy || !previousId || !currentId || previousId === currentId
            }
            onClick={async () => {
              const version = ++request.current;
              setBusy(true);
              setError("");
              setResult(null);
              try {
                const [previous, current] = await Promise.all(
                  [previousId, currentId].map((id) =>
                    api<AdReportSnapshot>(
                      "/finance/ad-reports/" + encodeURIComponent(id),
                    ),
                  ),
                );
                if (version === request.current)
                  setResult({
                    previous,
                    current,
                    comparison: compareAdReports(previous, current),
                  });
              } catch (reason) {
                if (version === request.current)
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not load the selected reports.",
                  );
              } finally {
                if (version === request.current) setBusy(false);
              }
            }}
          >
            {busy ? "Comparing…" : "Compare reports"}
          </button>
          {previousId && previousId === currentId && (
            <p className="subtle small">Choose two different saved reports.</p>
          )}
        </>
      )}
      {error && (
        <div role="alert">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {comparison?.kind === "mismatch" && (
        <Notice tone="warning">{comparison.reason}</Notice>
      )}
      {result && comparison && comparison.kind !== "mismatch" && (
        <>
          <p className="subtle small">
            Previous: {result.previous.filename}. Current:{" "}
            {result.current.filename}. Labels describe your selections, not the
            chronological order of report dates.
          </p>
          <Notice
            tone={comparison.kind === "unknown-scope" ? "warning" : "info"}
          >
            {comparison.kind === "unknown-scope"
              ? "Domain or timezone is not recorded for one or both reports. These are file differences; a traffic trend cannot be confirmed."
              : "Recorded domain and timezone labels match. Verify all Adsterra filters, including country and placement; labels alone cannot prove equivalent exports."}
          </Notice>
          <div className="table-scroll">
            <table>
              <caption>Coverage comparison (reported USD revenue)</caption>
              <thead>
                <tr>
                  <th>Coverage</th>
                  <th>Previous ad impressions</th>
                  <th>Current ad impressions</th>
                  <th>Previous clicks</th>
                  <th>Current clicks</th>
                  <th>Previous revenue</th>
                  <th>Current revenue</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: `Matching dates (${comparison.matchingPrevious?.dates.length ?? 0})`,
                    previous: comparison.matchingPrevious,
                    current: comparison.matchingCurrent,
                  },
                  {
                    label: `Only in previous (${comparison.onlyPrevious?.dates.length ?? 0})`,
                    previous: comparison.onlyPrevious,
                    current: null,
                  },
                  {
                    label: `Only in current (${comparison.onlyCurrent?.dates.length ?? 0})`,
                    previous: null,
                    current: comparison.onlyCurrent,
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td>
                      {row.previous?.impressions.toLocaleString("en-US") ??
                        "Not reported"}
                    </td>
                    <td>
                      {row.current?.impressions.toLocaleString("en-US") ??
                        "Not reported"}
                    </td>
                    <td>
                      {row.previous?.clicks.toLocaleString("en-US") ??
                        "Not reported"}
                    </td>
                    <td>
                      {row.current?.clicks.toLocaleString("en-US") ??
                        "Not reported"}
                    </td>
                    <td>
                      {row.previous
                        ? adReportMoney(row.previous.revenue)
                        : "Not reported"}
                    </td>
                    <td>
                      {row.current
                        ? adReportMoney(row.current.revenue)
                        : "Not reported"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!comparison.matchingPrevious && (
            <p className="subtle small">
              No matching dates. There is no common-date revision comparison.
            </p>
          )}
          <details>
            <summary>Daily report differences</summary>
            <div className="table-scroll">
              <table>
                <caption>Daily coverage and impressions</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Coverage</th>
                    <th>Previous ad impressions</th>
                    <th>Current ad impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.date}>
                      <td className="nowrap">{row.date}</td>
                      <td>
                        {row.previous && row.current
                          ? "Matching date"
                          : row.previous
                            ? "Only in previous"
                            : "Only in current"}
                      </td>
                      <td>
                        {row.previous?.impressions.toLocaleString("en-US") ??
                          "Not reported"}
                      </td>
                      <td>
                        {row.current?.impressions.toLocaleString("en-US") ??
                          "Not reported"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="subtle small">
            Dates absent from a file are not assumed to have zero activity.
            Reports are not added together. Ad impressions are not visitors, and
            exported revenue is not proof of payment.
          </p>
        </>
      )}
    </section>
  );
}
