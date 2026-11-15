"use client";
import { IndexingOverview } from "./indexing";
import { ArticlePerformance } from "./performance";
import { TrafficSync } from "./traffic-sync";
import { AdsterraReport } from "./adsterra-report";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  CircleDollarSign,
  ExternalLink,
  FileUp,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api, post, money, formatDate } from "@/lib/api";
import { Dashboard, Job } from "@/lib/types";
import { ViewProps, PageHeading, ResourceState, Metric } from "./views";
import { Badge, Empty, Field, Modal, Notice } from "./ui";
import { useAction, useResource } from "./hooks";
export function Finance({
  notify,
  expenses = false,
}: ViewProps & { expenses?: boolean }) {
  const [month, setMonth] = useState(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7),
    ),
    [modal, setModal] = useState(false),
    [importing, setImporting] = useState(false),
    [csv, setCsv] = useState(""),
    [form, setForm] = useState({
      date: new Date().toISOString().slice(0, 10),
      kind: expenses ? "EXPENSE" : "ACTUAL_REVENUE",
      category: expenses ? "Hosting" : "Adsterra",
      amount: "",
      source: "Manual · owner verified",
      reference: "",
      note: "",
    });
  const r = useResource<Dashboard>("/dashboard?month=" + month),
    a = useAction(notify),
    d = r.data;
  const list =
    d?.entries.filter((e) =>
      expenses ? e.kind === "EXPENSE" : e.kind !== "EXPENSE",
    ) || [];
  return (
    <>
      <PageHeading
        eyebrow={expenses ? "KNOW YOUR COSTS" : "MEASURE WHAT MATTERS"}
        title={
          expenses
            ? "Make the numbers make sense."
            : "Monetization"
        }
        description={
          expenses
            ? "Track operating costs and compare them against actual revenue."
            : "Track verified Adsterra earnings, with estimates kept clearly separate."
        }
      >
        <button className="secondary" onClick={() => setImporting(true)}>
          <FileUp size={16} />
          Import CSV
        </button>
        <button className="primary" onClick={() => setModal(true)}>
          <Plus size={16} />
          {expenses ? "Add expense" : "Record earnings"}
        </button>
      </PageHeading>
      <div className="inline spaced-bottom">
        <label className="inline subtle small">
          Reporting month{" "}
          <input
            type="month"
            aria-label="Reporting month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <ResourceState {...r} />
      {!expenses && <AdsterraReport />}
      {d && (
        <>
          <div className="metric-grid">
            <Metric
              label="Actual revenue"
              value={money(d.finance.actualRevenue)}
              icon={<CircleDollarSign size={20} />}
              detail="Owner verified / imported records"
            />
            <Metric
              label={expenses ? "Total operating costs" : "Estimated earnings"}
              value={money(
                expenses ? d.finance.expenses : d.finance.estimatedRevenue,
              )}
              icon={<Wallet size={20} />}
              detail={
                expenses
                  ? "Includes recorded AI API usage"
                  : "Excluded from actual profit"
              }
              tint="orange"
            />
            <Metric
              label="Net profit / loss"
              value={money(d.finance.netProfit)}
              icon={<TrendingUp size={20} />}
              detail="Actual earnings minus expenses"
              tint="purple"
            />
            <Metric
              label={
                expenses
                  ? "Revenue to break even"
                  : "Revenue per 1,000 pageviews"
              }
              value={
                expenses
                  ? money(d.finance.breakEvenRevenue)
                  : d.finance.rpm === null
                    ? "—"
                    : money(d.finance.rpm)
              }
              icon={<ShieldCheck size={20} />}
              detail={
                expenses
                  ? "Based on recorded costs"
                  : d.traffic.viewSource || "Pageviews needed to calculate RPM"
              }
              tint="blue"
            />
          </div>
          {!expenses && (
            <Notice>
              Adsterra records are manually entered or imported from an official
              export. The publisher API is documented; this version does not
              automatically sync it. No ad code is injected.
            </Notice>
          )}
          <p className="subtle small spaced-bottom">
            Actual revenue change from the previous month:{" "}
            {d.monthOverMonth === null
              ? "unavailable without a positive prior baseline"
              : d.monthOverMonth.toFixed(1) + "%"}
            . Calculated from recorded actual earnings.
          </p>
          {expenses && (
            <Notice>
              AI cost: {money(d.finance.aiCost)} from recorded usage. Uncertain
              provider outcomes retain conservative reserved costs. Estimates
              never offset expenses.
            </Notice>
          )}
          <section className="panel spaced">
            <div className="panel-heading">
              <h2>{expenses ? "Operating expenses" : "Earnings ledger"}</h2>
              <span className="subtle small">USD · {month}</span>
            </div>
            {list.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Type / source</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id}>
                        <td className="nowrap">{formatDate(e.date)}</td>
                        <td>
                          <strong>{e.category}</strong>
                          <div className="subtle small">{e.note}</div>
                        </td>
                        <td className="money-cell">
                          {money(Number(e.amount))}
                        </td>
                        <td>
                          <Badge value={e.kind} />
                          <div className="subtle small">{e.source}</div>
                        </td>
                        <td className="subtle small">{e.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={
                  expenses
                    ? "Know your starting costs"
                    : "Your first earnings belong here"
                }
                description={
                  expenses
                    ? "Local software is free. Add any real hosting, API or other operating cost as it occurs."
                    : "Zero earnings is a valid starting point. Add actual amounts only when you have a real reporting record."
                }
                action={
                  <button className="secondary" onClick={() => setModal(true)}>
                    <Plus size={16} />
                    {expenses ? "Add first expense" : "Record first entry"}
                  </button>
                }
              />
            )}
          </section>
          {!expenses && (
            <section className="panel padded spaced">
              <h2>Adsterra setup & responsible placement</h2>
              <ol className="help-list">
                <li>
                  Register as a publisher, add the actual Blogger site and
                  complete any required review.
                </li>
                <li>
                  Review both networks’ current policies. Copy approved ad code
                  manually into an appropriate Blogger theme or HTML gadget
                  placement.
                </li>
                <li>
                  Use clear, non-disruptive placements. Avoid forced redirects,
                  misleading ads and aggressive overlays.
                </li>
                <li>
                  Export verified revenue reports and import them here, or enter
                  amounts with a unique reference.
                </li>
              </ol>
              <a
                className="text-link"
                href="https://publishers.adsterra.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open official publisher dashboard
                <ExternalLink size={14} />
              </a>
            </section>
          )}
        </>
      )}
      {modal && (
        <Modal
          title={
            expenses
              ? "Record an operating expense"
              : "Record verified or estimated revenue"
          }
          onClose={() => setModal(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () => {
                await post("/finance", {
                  ...form,
                  amount: Number(form.amount),
                });
                setModal(false);
                setForm({ ...form, amount: "", reference: "", note: "" });
                await r.reload();
              }, "Financial entry recorded.");
            }}
          >
            <div className="form-grid">
              <Field label="Date">
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Record type">
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                >
                  {expenses ? (
                    <option value="EXPENSE">Operating expense</option>
                  ) : (
                    <>
                      <option value="ACTUAL_REVENUE">
                        Actual verified earnings
                      </option>
                      <option value="ESTIMATED_REVENUE">
                        Estimated earnings
                      </option>
                    </>
                  )}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Amount · USD">
                <input
                  required
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.000001"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="Category / network">
                <input
                  required
                  minLength={2}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field
              label="Unique report reference"
              hint="Prevents duplicate import of the same payment or report."
            >
              <input
                required
                minLength={2}
                maxLength={120}
                placeholder="adsterra-2026-11-01-site1"
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </Field>
            <Field label="Data source">
              <input
                required
                minLength={3}
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </Field>
            <Field label="Notes / supporting evidence">
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={a.busy}>
                Save record
              </button>
            </div>
          </form>
        </Modal>
      )}
      {importing && (
        <Modal title="Import financial CSV" onClose={() => setImporting(false)}>
          <p className="subtle small">
            Headers: date,kind,category,amount,reference,source,note. Kinds:
            ACTUAL_REVENUE, ESTIMATED_REVENUE, EXPENSE. USD only. Existing
            references are skipped.
          </p>
          <Field label="Choose CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1000000) {
                    notify("Maximum CSV size is 1 MB.", true);
                    return;
                  }
                  setCsv(await file.text());
                }
              }}
            />
          </Field>
          <Field label="CSV content">
            <textarea
              className="code-input"
              rows={9}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </Field>
          <button
            className="primary"
            disabled={a.busy || !csv}
            onClick={() =>
              a.run(async () => {
                const x = await post<{ imported: number; skipped: number }>(
                  "/finance/import",
                  { csv },
                );
                notify(
                  `${x.imported} imported, ${x.skipped} duplicate references skipped.`,
                );
                setImporting(false);
                await r.reload();
              })
            }
          >
            Import records
          </button>
        </Modal>
      )}
    </>
  );
}
export function Traffic({ notify, integrations }: ViewProps) {
  const r = useResource<Dashboard>("/dashboard"),
    a = useAction(notify);
  const [csv, setCsv] = useState(""),
    [sitemap, setSitemap] = useState(""),
    [result, setResult] = useState<{ valid: boolean; note: string } | null>(
      null,
    ),
    [date, setDate] = useState({
      start: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    });
  const d = r.data;
  return (
    <>
      <PageHeading
        eyebrow="READERS, NOT JUST NUMBERS"
        title="Traffic & SEO"
        description="Connect authorized reporting or import your real traffic records."
      />
      <IndexingOverview notify={notify} />
      <ArticlePerformance />
      <TrafficSync notify={notify} />
      <ResourceState {...r} />
      {d && (
        <div className="metric-grid">
          <Metric
            label="Pageviews"
            value={d.traffic.pageviews?.toLocaleString() ?? "—"}
            detail={d.traffic.viewSource || "Not connected"}
            icon={<TrendingUp size={19} />}
            tint="blue"
          />
          <Metric
            label="Search impressions"
            value={d.traffic.impressions?.toLocaleString() ?? "—"}
            detail={d.traffic.searchSource || "Not connected"}
            icon={<TrendingUp size={19} />}
            tint="purple"
          />
          <Metric
            label="Search clicks"
            value={d.traffic.clicks?.toLocaleString() ?? "—"}
            detail={d.traffic.searchSource || "Not connected"}
            icon={<TrendingUp size={19} />}
            tint="green"
          />
          <Metric
            label="Search CTR"
            value={
              d.traffic.ctr === null ? "—" : d.traffic.ctr.toFixed(2) + "%"
            }
            detail="Calculated from recorded search data"
            icon={<TrendingUp size={19} />}
            tint="orange"
          />
        </div>
      )}
      <div className="two-column">
        <section className="panel padded">
          <h2>Sync official Google reports</h2>
          <p className="subtle">
            Authorize read-only reporting and configure your properties in
            Integration setup. Google reporting uses its own property date
            conventions.
          </p>
          <div className="form-grid">
            <Field label="Start date">
              <input
                type="date"
                value={date.start}
                onChange={(e) => setDate({ ...date, start: e.target.value })}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={date.end}
                onChange={(e) => setDate({ ...date, end: e.target.value })}
              />
            </Field>
          </div>
          <div className="inline wrap">
            <button
              className="secondary"
              disabled={
                a.busy ||
                !integrations?.searchConsoleConfigured ||
                !integrations?.searchConsoleReadAccess
              }
              onClick={() =>
                a.run(async () => {
                  try {
                    const x = await post<{
                      imported: number;
                      note: string;
                      sync?: { state: string };
                    }>("/integrations/search-console/sync", date);
                    notify(
                      x.sync?.state === "RUNNING"
                        ? x.note
                        : `${x.imported} search rows imported. ${x.note}`,
                    );
                    await r.reload();
                  } finally {
                    window.dispatchEvent(new Event("traffic-records-changed"));
                  }
                })
              }
            >
              <RefreshCw size={15} />
              Search Console
            </button>
            <button
              className="secondary"
              disabled={
                a.busy ||
                !integrations?.analyticsConfigured ||
                !integrations?.analyticsReadAccess
              }
              onClick={() =>
                a.run(async () => {
                  const x = await post<{ imported: number }>(
                    "/integrations/analytics/sync",
                    date,
                  );
                  notify(`${x.imported} Analytics rows imported.`);
                  window.dispatchEvent(new Event("traffic-records-changed"));
                  await r.reload();
                })
              }
            >
              <RefreshCw size={15} />
              Google Analytics
            </button>
          </div>
          <Link className="text-link spaced" href="/integrations">
            Configure reporting
            <ArrowRight size={14} />
          </Link>
          <h3 className="spaced">Or import traffic CSV</h3>
          <p className="subtle small">
            Headers: date,url,pageviews,impressions,clicks,source. Leave
            unavailable metrics blank. Re-imports update the same date, URL and
            source.
          </p>
          <Field label="Traffic CSV">
            <textarea
              rows={5}
              className="code-input"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"date,url,pageviews,impressions,clicks,source"}
            />
          </Field>
          <button
            className="primary"
            disabled={a.busy || !csv}
            onClick={() =>
              a.run(async () => {
                const x = await post<{ imported: number }>("/traffic/import", {
                  csv,
                });
                notify(`${x.imported} traffic rows imported.`);
                window.dispatchEvent(new Event("traffic-records-changed"));
                await r.reload();
              }, "Traffic updated.")
            }
          >
            <FileUp size={15} />
            Import real traffic
          </button>
        </section>
        <section className="panel padded">
          <h2>Sitemap & search readiness</h2>
          <p className="subtle">
            Verify a public Blogger sitemap. Successful retrieval does not
            guarantee indexing.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () =>
                setResult(await post("/seo/sitemap", { url: sitemap })),
              );
            }}
          >
            <Field label="Sitemap URL">
              <input
                type="url"
                required
                value={sitemap}
                onChange={(e) => setSitemap(e.target.value)}
                placeholder="https://your-blog.blogspot.com/sitemap.xml"
              />
            </Field>
            <button className="secondary" disabled={a.busy}>
              Verify sitemap
            </button>
          </form>
          {result && (
            <Notice tone={result.valid ? "success" : "warning"}>
              {result.valid
                ? "Sitemap XML found. "
                : "No valid sitemap found. "}
              {result.note}
            </Notice>
          )}
          <h3 className="spaced">Submit through Search Console</h3>
          <ol className="help-list">
            <li>Verify ownership of the actual blog or domain.</li>
            <li>Open your property’s Sitemaps section.</li>
            <li>
              Submit the verified sitemap URL and inspect its processing status.
            </li>
            <li>
              Use URL Inspection to check public pages and request indexing
              where appropriate.
            </li>
          </ol>
          <a
            className="text-link"
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noreferrer"
          >
            Open Search Console
            <ExternalLink size={14} />
          </a>
          <Notice>
            Keep titles descriptive, code accurate and headings useful. Avoid
            manipulative links or scaled low-value posts. No automated score
            guarantees ranking.
          </Notice>
        </section>
      </div>
    </>
  );
}
export function Jobs({ notify }: ViewProps) {
  const r = useResource<{
      jobs: Job[];
      counts: Record<string, number>;
      workers: { id: string; lastSeen: string }[];
    }>("/jobs"),
    logs =
      useResource<
        { id: string; action: string; message: string; createdAt: string }[]
      >("/logs"),
    a = useAction(notify);
  return (
    <>
      <PageHeading
        eyebrow="BEHIND THE SCENES"
        title="Job history"
        description="Persistent job history, queue health, failure reasons, and your audit trail."
      >
        <button
          className="secondary"
          onClick={() => {
            void r.reload();
            void logs.reload();
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </PageHeading>
      <ResourceState {...r} />
      {r.data && (
        <>
          <div className="metric-grid">
            <Metric
              label="Queue waiting"
              value={String(
                (r.data.counts.waiting || 0) + (r.data.counts.delayed || 0),
              )}
              detail="Redis / BullMQ"
              icon={<RefreshCw size={18} />}
            />
            <Metric
              label="Active jobs"
              value={String(r.data.counts.active || 0)}
              detail="Worker execution"
              icon={<RefreshCw size={18} />}
              tint="blue"
            />
            <Metric
              label="Failed jobs"
              value={String(
                r.data.jobs.filter((j) => j.state === "FAILED").length,
              )}
              detail="Permanent failures need review"
              icon={<ShieldCheck size={18} />}
              tint="orange"
            />
            <Metric
              label="Workers online"
              value={String(
                r.data.workers.filter(
                  (w) => Date.now() - new Date(w.lastSeen).getTime() < 90000,
                ).length,
              )}
              detail="Heartbeat within 90 seconds"
              icon={<ShieldCheck size={18} />}
              tint="purple"
            />
          </div>
          <section className="panel spaced">
            <div className="panel-heading">
              <h2>Publishing history</h2>
              <span className="small subtle">Latest 200 records</span>
            </div>
            {r.data.jobs.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Article / scheduled time</th>
                      <th>State</th>
                      <th>Mode</th>
                      <th>Attempts</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.jobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <Link
                            href={"/articles/" + j.articleId}
                            className="article-title"
                          >
                            {j.article?.title || j.articleId}
                          </Link>
                          <div className="subtle small">
                            {formatDate(j.scheduledAt, true)}
                          </div>
                        </td>
                        <td>
                          <Badge value={j.state} />
                        </td>
                        <td>
                          <Badge value={j.mode} />
                          <div className="subtle small">
                            {j.target === "blogger"
                              ? "Managed by Blogger"
                              : "Local worker"}
                          </div>
                        </td>
                        <td>{j.attempts}</td>
                        <td>
                          <span className="small warning-text">{j.error}</span>
                          {j.state === "FAILED" && j.target !== "blogger" && (
                            <button
                              className="text-button"
                              disabled={a.busy}
                              onClick={() =>
                                a.run(async () => {
                                  await post("/jobs/" + j.id + "/retry");
                                  await r.reload();
                                }, "Retry scheduled after fresh validation.")
                              }
                            >
                              Review & retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No jobs have run yet"
                description="When you schedule an approved article, its durable record and result appear here."
              />
            )}
          </section>
        </>
      )}
      <section className="panel spaced">
        <div className="panel-heading">
          <h2>Audit trail</h2>
        </div>
        {logs.data?.length ? (
          <div className="stack-list">
            {logs.data.map((log) => (
              <div className="list-row" key={log.id}>
                <div>
                  <strong className="small">
                    {log.action.replaceAll("_", " ")}
                  </strong>
                  <p className="small subtle">{log.message}</p>
                </div>
                <time className="small subtle nowrap">
                  {formatDate(log.createdAt, true)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="padded subtle">No events recorded yet.</p>
        )}
      </section>
    </>
  );
}
