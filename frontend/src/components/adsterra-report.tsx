"use client";
import { useEffect, useRef, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { parseAdsterraReport, adReportMoney } from "@/lib/adsterra-report";
import { Field, Notice } from "./ui";
import { AdReportComparison } from "./ad-report-comparison";

type SavedAdReport = {
  id: string;
  filename: string;
  scopeLabel: string;
  timezoneLabel: string;
  createdAt: string;
  report: ReturnType<typeof parseAdsterraReport>;
};

export function AdsterraReport() {
  const [report, setReport] = useState<ReturnType<
    typeof parseAdsterraReport
  > | null>(null);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [csv, setCsv] = useState("");
  const [scopeLabel, setScopeLabel] = useState("");
  const [timezoneLabel, setTimezoneLabel] = useState("");
  const [history, setHistory] = useState<SavedAdReport[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const selection = useRef(0);
  async function reload() {
    try {
      setHistory(await api<SavedAdReport[]>("/finance/ad-reports"));
      setHistoryError("");
    } catch {
      setHistoryError(
        "Saved reports could not be loaded. Try refreshing the page.",
      );
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  return (
    <section
      className="panel padded spaced"
      aria-label="Adsterra report preview"
    >
      <h2>Adsterra report preview</h2>
      <p className="subtle small">
        Choose a native CSV export grouped by Date. Save a report to keep it
        after a refresh. Reports stay separate from earnings and traffic
        records.
      </p>
      {historyError && <Notice tone="warning">{historyError}</Notice>}
      {history.length > 0 && (
        <Field label="Saved Adsterra reports (latest 30)">
          <select
            disabled={busy}
            value=""
            onChange={async (event) => {
              const id = event.target.value;
              if (!id) return;
              ++selection.current;
              setBusy(true);
              setError("");
              setSavedMessage("");
              setReport(null);
              setCsv("");
              try {
                const saved = await api<SavedAdReport>(
                  "/finance/ad-reports/" + encodeURIComponent(id),
                );
                setReport(saved.report);
                setFilename(saved.filename);
                setScopeLabel(saved.scopeLabel);
                setTimezoneLabel(saved.timezoneLabel);
                setSavedMessage(
                  "Loaded saved snapshot from " +
                    formatDate(saved.createdAt, true) +
                    ".",
                );
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Could not load report.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <option value="">Choose a saved report</option>
            {history.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {formatDate(saved.createdAt, true)} ·{" "}
                {saved.scopeLabel || "Domain not recorded"} · {saved.filename}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Adsterra CSV report">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (event) => {
            const version = ++selection.current;
            const file = event.target.files?.[0];
            setReport(null);
            setError("");
            setFilename("");
            setCsv("");
            setSavedMessage("");
            setScopeLabel("");
            setTimezoneLabel("");
            if (!file) return;
            try {
              if (file.size > 1_000_000)
                throw new Error("Maximum report size is 1 MB.");
              const text = await file.text();
              const parsed = parseAdsterraReport(text);
              if (version === selection.current) {
                setReport(parsed);
                setFilename(file.name);
                setCsv(text);
              }
            } catch (reason) {
              if (version === selection.current)
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Could not read this report.",
                );
            }
          }}
        />
      </Field>
      {error && (
        <div role="alert">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {report && (
        <>
          {csv && (
            <>
              <Field label="Domain filter used in Adsterra (optional)">
                <input
                  maxLength={200}
                  disabled={busy}
                  value={scopeLabel}
                  placeholder="For example, devaitoolbox.blogspot.com or All Domains"
                  onChange={(event) => setScopeLabel(event.target.value)}
                />
              </Field>
              <Field label="Report timezone (optional)">
                <input
                  maxLength={80}
                  disabled={busy}
                  value={timezoneLabel}
                  placeholder="For example, GMT+00:00"
                  onChange={(event) => setTimezoneLabel(event.target.value)}
                />
              </Field>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setSavedMessage("");
                  try {
                    const body = new FormData();
                    body.append(
                      "file",
                      new Blob([csv], { type: "text/csv" }),
                      filename,
                    );
                    body.append("filename", filename.slice(0, 200));
                    body.append("scopeLabel", scopeLabel);
                    body.append("timezoneLabel", timezoneLabel);
                    await api("/finance/ad-reports", { method: "POST", body });
                    setSavedMessage(
                      "Report saved. Identical snapshots are kept once. Overlapping reports are not added together.",
                    );
                    await reload();
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Could not save report.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save ad report"}
              </button>
            </>
          )}
          {savedMessage && (
            <div role="status">
              <Notice tone="success">{savedMessage}</Notice>
            </div>
          )}
          {!csv && (
            <p className="subtle small">
              Recorded domain filter: {scopeLabel || "Not recorded"}. Timezone:{" "}
              {timezoneLabel || "Not recorded"}. These labels were entered by
              the owner and are not verified from CSV.
            </p>
          )}
          <p className="subtle small">
            {filename} · {report.rows[0].date} to {report.rows.at(-1)!.date} ·{" "}
            {report.rows.length} reported dates. Missing dates remain
            unreported.
          </p>
          <Notice>
            Ad impressions are not visitors or pageviews. This export contains
            no domain or timezone metadata; verify those filters in Adsterra.
            Revenue is shown as exported and may be rounded or revised. It is
            not proof of payment.
          </Notice>
          <div className="table-scroll">
            <table>
              <caption>Adsterra daily results (USD)</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ad impressions</th>
                  <th>Ad clicks</th>
                  <th>CTR</th>
                  <th>Reported CPM</th>
                  <th>Reported revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.date}>
                    <td className="nowrap">{row.date}</td>
                    <td>{row.impressions.toLocaleString("en-US")}</td>
                    <td>{row.clicks.toLocaleString("en-US")}</td>
                    <td>
                      {row.impressions
                        ? ((row.clicks / row.impressions) * 100).toFixed(3) +
                          "%"
                        : "Unavailable"}
                    </td>
                    <td>{adReportMoney(row.cpm)}</td>
                    <td>{adReportMoney(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td>{report.impressions.toLocaleString("en-US")}</td>
                  <td>{report.clicks.toLocaleString("en-US")}</td>
                  <td>
                    {report.ctr === null
                      ? "Unavailable"
                      : report.ctr.toFixed(3) + "%"}
                  </td>
                  <td>Not aggregated</td>
                  <td>{adReportMoney(report.revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {report.revenue === 0 && (
            <p className="subtle small">
              Every revenue row exports $0. More precise earnings cannot be
              recovered from this file.
            </p>
          )}
        </>
      )}
      <AdReportComparison history={history} />
    </section>
  );
}
