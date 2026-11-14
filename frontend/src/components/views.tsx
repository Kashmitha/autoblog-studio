"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  FlaskConical,
  Lightbulb,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, post, money, formatDate } from "@/lib/api";
import {
  Article,
  Dashboard,
  Integrations,
  Settings,
  Status,
} from "@/lib/types";
import type { Notify } from "./studio";
import { ArticleRows, Badge, Empty, Field, Modal, Notice } from "./ui";
import { useAction, useResource } from "./hooks";
import { IndexingOverview } from "./indexing";
import { WeeklyReview } from "./weekly-review";
import { EditorialPipeline } from "./editorial-pipeline";
import { ContentBacklog } from "./content-backlog";
export { Connections } from "./connections";
export { Finance, Traffic, Jobs } from "./finance-views";
export { MediaLibrary, Help, Preferences } from "./media-help";
export interface ViewProps {
  notify: Notify;
  integrations: Integrations | null;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function ResourceState({
  error,
  loading,
  reload,
}: {
  error: string;
  loading: boolean;
  reload: () => unknown;
}) {
  if (error)
    return (
      <Notice tone="warning">
        {error}{" "}
        <button className="text-button" onClick={() => reload()}>
          Try again
        </button>
      </Notice>
    );
  if (loading)
    return (
      <div className="skeleton-grid">
        <div />
        <div />
        <div />
      </div>
    );
  return null;
}
export function Overview({ notify, integrations }: ViewProps) {
  const reminders = useResource<{ id: string; title: string }[]>("/reminders");
  const r = useResource<Dashboard>("/dashboard");
  const d = r.data;
  const [series, setSeries] = useState<"revenue" | "pageviews">("revenue");
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <>
      <PageHeading
        eyebrow="YOUR PUBLISHING WORKSPACE"
        title="Publishing overview"
        description="Track your articles, publishing queue and measured results."
      >
        <Link className="button secondary" href="/calendar">
          <CalendarDays size={16} />
          View calendar
        </Link>
        <Link className="button primary" href="/articles?new=1">
          <Plus size={17} />
          New article
        </Link>
      </PageHeading>
      <div className="overview-meta">
        <span>
          <span className="status-dot" />
          Your studio at a glance
        </span>
        <span>
          {today} <span className="muted">· Asia/Colombo</span>
        </span>
      </div>
      <ResourceState {...r} />
      {d && (
        <>
          {d.jobs.some((j) => j.state === "FAILED") && (
            <Notice tone="warning">
              {d.jobs.filter((j) => j.state === "FAILED").length} publishing
              jobs need attention.{" "}
              <Link href="/jobs" className="text-link">
                Inspect failure reasons
              </Link>
            </Notice>
          )}
          {!!reminders.data?.length && (
            <Notice>
              {reminders.data.length} articles are due for a content update.{" "}
              {reminders.data.map((item) => (
                <Link
                  key={item.id}
                  href={"/articles/" + item.id}
                  className="text-link"
                >
                  {item.title}
                </Link>
              ))}
            </Notice>
          )}
          <div className="metric-grid">
            <Metric
              label="Actual revenue"
              value={money(d.finance.actualRevenue)}
              icon={<CircleDollarSign size={20} />}
              detail={
                d.hasFinancialRecords
                  ? "From recorded actual earnings"
                  : "No actual earnings recorded"
              }
              tint="green"
            />
            <Metric
              label="Pageviews"
              value={
                d.traffic.pageviews === null
                  ? "—"
                  : d.traffic.pageviews.toLocaleString()
              }
              icon={<Users size={20} />}
              detail={
                d.traffic.viewSource || "Connect analytics or import data"
              }
              tint="blue"
            />
            <Metric
              label="Published articles"
              value={String(d.counts.PUBLISHED || 0)}
              icon={<FileText size={20} />}
              detail={`${d.totalArticles} articles in your workspace`}
              tint="purple"
            />
            <Metric
              label="Net profit"
              value={money(d.finance.netProfit)}
              icon={<TrendingUp size={20} />}
              detail="Actual revenue minus recorded costs"
              tint="orange"
            />
          </div>
          <IndexingOverview notify={notify} compact />
          <WeeklyReview />
          <div className="dashboard-main-grid">
            <section className="panel performance-panel">
              <div className="panel-heading">
                <div>
                  <h2>Performance over time</h2>
                  <p>Make decisions from your own numbers.</p>
                </div>
                <span className="small subtle month-pill">
                  {new Date(d.month + "-15").toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="chart-tabs">
                <button
                  className={series === "revenue" ? "selected" : ""}
                  onClick={() => setSeries("revenue")}
                >
                  <span className="chart-dot" />
                  Revenue
                </button>
                <button
                  className={series === "pageviews" ? "selected" : ""}
                  onClick={() => setSeries("pageviews")}
                >
                  <span className="chart-dot blue" />
                  Pageviews
                </button>
                <span className="chart-source">
                  {series === "revenue"
                    ? "Actual · recorded USD"
                    : "Source: " + (d.traffic.viewSource || "not connected")}
                </span>
              </div>
              {(
                series === "revenue"
                  ? d.hasFinancialRecords
                  : d.traffic.pageviews !== null
              ) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height={245}>
                    <AreaChart data={d.daily}>
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="#2c8b63"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#2c8b63"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--line)"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => String(Number(v.slice(8)))}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--panel)",
                          borderColor: "var(--line)",
                          borderRadius: 10,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={series}
                        stroke="#2c8b63"
                        fill="url(#area)"
                        strokeWidth={2.5}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="chart-empty">
                  <div className="chart-empty-lines" />
                  <div className="chart-empty-message">
                    <div className="empty-icon">
                      <TrendingUp size={23} />
                    </div>
                    <h3>Your story starts with real data</h3>
                    <p>
                      {series === "revenue"
                        ? "Record your first earnings to see revenue trends."
                        : "Connect Google Analytics or import your pageviews."}
                      <br />
                      Your numbers will appear here as they come in.
                    </p>
                    <Link
                      href={
                        series === "revenue" ? "/monetization" : "/analytics"
                      }
                      className="text-link"
                    >
                      {series === "revenue"
                        ? "Add a revenue entry"
                        : "Set up traffic tracking"}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
              <div className="chart-foot">
                <ShieldCheck size={14} />
                Real records only. Estimates never count toward net profit.
              </div>
            </section>
            <section className="panel goal-panel">
              <div className="goal-heading">
                <span className="eyebrow">ONE STEP AT A TIME</span>
                <div className="goal-icon">↗</div>
              </div>
              <h2>
                Build your first
                <br />
                profitable month.
              </h2>
              <p>
                Small experiments. Useful articles.
                <br />
                Room to grow.
              </p>
              <div className="goal-numbers">
                <strong>{money(d.finance.actualRevenue)}</strong>
                <span> / $10 first milestone</span>
              </div>
              <div className="progress-track">
                <div style={{ width: d.goals.progress + "%" }} />
              </div>
              <div className="goal-labels">
                <span>{Math.round(d.goals.progress)}% of first goal</span>
                <span>This month</span>
              </div>
              <div className="goal-milestones">
                <div>
                  <span className="milestone-dot" />
                  Early experiment<strong>$10–$30 / mo</strong>
                </div>
                <div>
                  <span className="milestone-dot outline" />
                  Longer-term goal<strong>$100 / mo</strong>
                </div>
              </div>
              <p className="goal-disclaimer">
                Targets to learn toward, never guaranteed earnings.
              </p>
              <Link className="text-link" href="/expenses">
                Explore profitability
                <ArrowRight size={15} />
              </Link>
            </section>
          </div>
          <section className="panel pipeline-panel">
            <div className="panel-heading">
              <div>
                <h2>Your editorial pipeline</h2>
                <p>Every good article moves through a little care.</p>
              </div>
              <Link className="text-link" href="/articles">
                All articles
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="pipeline">
              {[
                {
                  label: "Ideas & drafts",
                  n:
                    (d.counts.PLANNED || 0) +
                    (d.counts.DRAFTING || 0) +
                    (d.counts.RESEARCHING || 0),
                  icon: Lightbulb,
                  color: "purple",
                },
                {
                  label: "Needs review",
                  n: d.counts.NEEDS_REVIEW || 0,
                  icon: ShieldCheck,
                  color: "orange",
                },
                {
                  label: "Approved",
                  n: d.counts.APPROVED || 0,
                  icon: Check,
                  color: "green",
                },
                {
                  label: "Scheduled",
                  n: d.counts.SCHEDULED || 0,
                  icon: Clock3,
                  color: "blue",
                },
                {
                  label: "Published",
                  n: d.counts.PUBLISHED || 0,
                  icon: FileText,
                  color: "green",
                },
              ].map((step, i) => (
                <div className="pipeline-step" key={step.label}>
                  <div className={"pipeline-icon " + step.color}>
                    <step.icon size={18} />
                  </div>
                  <div>
                    <strong>{step.n}</strong>
                    <span>{step.label}</span>
                  </div>
                  {i < 4 && <span className="pipeline-arrow">›</span>}
                </div>
              ))}
            </div>
            <div className="chart-foot">
              <ShieldCheck size={14} />
              {d.jobs.filter((j) => j.state === "FAILED").length} failed jobs ·
              Live publishing success rate:{" "}
              {d.publishingSuccessRate === null
                ? "unavailable until a live attempt"
                : d.publishingSuccessRate.toFixed(1) + "%"}{" "}
              (latest 100 job records)
            </div>
          </section>
          <div className="dashboard-bottom-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent articles</h2>
                  <p>A home for your next useful idea.</p>
                </div>
                <Link className="text-link" href="/articles">
                  View all
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              {d.recentArticles.length ? (
                <ArticleRows articles={d.recentArticles} />
              ) : (
                <Empty
                  title="Your first article is a fresh start"
                  description="Start with a question you know how to answer. Add sources, write a draft, then make it your own."
                  action={
                    <Link className="button secondary" href="/articles?new=1">
                      <Plus size={16} />
                      Create an article
                    </Link>
                  }
                />
              )}
            </section>
            <section className="panel next-steps">
              <div className="panel-heading">
                <div>
                  <h2>Make yourself at home</h2>
                  <p>A few steps to your first publication.</p>
                </div>
                <span className="setup-count">
                  {Number(!!integrations?.google?.blogId) +
                    Number(d.totalArticles > 0)}{" "}
                  / 3
                </span>
              </div>
              <Link href="/connections" className="setup-step">
                <span
                  className={
                    integrations?.google?.blogId ? "step-done" : "step-number"
                  }
                >
                  {integrations?.google?.blogId ? <Check size={14} /> : 1}
                </span>
                <div>
                  <strong>Connect your Blogger account</strong>
                  <span>Choose the blog you want to grow.</span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/articles?new=1" className="setup-step">
                <span className={d.totalArticles ? "step-done" : "step-number"}>
                  {d.totalArticles ? <Check size={14} /> : 2}
                </span>
                <div>
                  <strong>Create something worth reading</strong>
                  <span>Bring a topic, add research, write.</span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/automation" className="setup-step">
                <span className="step-number">3</span>
                <div>
                  <strong>Find your publishing rhythm</strong>
                  <span>Schedule approved articles your way.</span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
              <div className="safe-mode">
                <FlaskConical size={17} />
                <span>
                  {integrations?.bloggerMode === "live"
                    ? "Live connection · owner approval required"
                    : "Mock mode is on. Nothing publishes to a real blog."}
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
export function Metric({
  label,
  value,
  icon,
  detail,
  tint = "green",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  detail: string;
  tint?: string;
}) {
  return (
    <section className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <div className={"metric-icon " + tint}>{icon}</div>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-detail">
        <span className="mini-dot" />
        {detail}
      </div>
    </section>
  );
}
export function Articles({ notify }: ViewProps) {
  const r = useResource<Article[]>("/articles"),
    router = useRouter(),
    a = useAction(notify);
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("ALL"),
    [modal, setModal] = useState(false),
    [title, setTitle] = useState(""),
    [niche, setNiche] = useState("DevOps");
  const [initial] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("new"),
  );
  const show = modal || (initial && title !== "__closed");
  const list = (r.data || []).filter(
    (a) =>
      (status === "ALL" || a.status === status) &&
      [a.title, a.niche].some((x) => x.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <>
      <PageHeading
        eyebrow="EDITORIAL"
        title="Articles"
        description="Write, review and manage your publication."
      >
        <button
          className="primary"
          onClick={() => {
            setTitle("");
            setModal(true);
          }}
        >
          <Plus size={17} />
          New article
        </button>
      </PageHeading>
      <div className="panel">
        <div className="filter-bar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search articles"
              placeholder="Search articles or topics…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            {[
              "PLANNED",
              "NEEDS_REVIEW",
              "APPROVED",
              "SCHEDULED",
              "PUBLISHED",
              "FAILED",
              "REJECTED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="subtle small">{list.length} articles</span>
        </div>
        <ResourceState {...r} />
        {list.length ? (
          <ArticleRows articles={list} />
        ) : (
          !r.loading && (
            <Empty
              title={
                q ? "No matching articles" : "A blank page, full of possibility"
              }
              description="Plan a specific tutorial or write a manual draft. Every AI draft requires your review."
              action={
                <button
                  className="secondary"
                  onClick={() => {
                    setTitle("");
                    setModal(true);
                  }}
                >
                  <Plus size={16} />
                  Create article
                </button>
              }
            />
          )
        )}
      </div>
      {show && (
        <Modal
          title="Start a new article"
          onClose={() => {
            setModal(false);
            setTitle("__closed");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () => {
                const result = await post<Article>("/articles", {
                  title,
                  niche,
                });
                router.push("/articles/" + result.id);
              }, "Article created.");
            }}
          >
            <Field label="Working title">
              <input
                required
                minLength={8}
                maxLength={180}
                placeholder="How to troubleshoot a failing Docker build"
                value={title === "__closed" ? "" : title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Topic area">
              <select value={niche} onChange={(e) => setNiche(e.target.value)}>
                {niches.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Notice>
              Start with an idea. Add primary sources and a draft in the editor.
            </Notice>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTitle("__closed");
                  setModal(false);
                }}
              >
                Cancel
              </button>
              <button className="primary" disabled={a.busy}>
                Create article
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export const niches = [
  "DevOps",
  "Git & GitHub",
  "Docker",
  "CI/CD",
  "ASP.NET Core",
  "C#",
  "SQL",
  "React",
  "Next.js",
  "NestJS",
  "PostgreSQL",
  "Troubleshooting",
  "Beginner programming",
];
export function Planner({ notify, integrations }: ViewProps) {
  const a = useAction(notify),
    router = useRouter();
  const [niche, setNiche] = useState("DevOps"),
    [title, setTitle] = useState(""),
    [intent, setIntent] = useState(""),
    [topics, setTopics] = useState<{ title: string; intent: string }[]>([]);
  return (
    <>
      <PageHeading
        eyebrow="IDEAS WITH INTENT"
        title="Topic planner"
        description="Plan useful tutorials around what a reader needs to do next."
      />
      <div className="two-column">
        <section className="panel padded">
          <h2>Add to your content plan</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () => {
                const item = await post<Article>("/articles", {
                  title,
                  niche,
                  intent,
                });
                router.push("/articles/" + item.id);
              });
            }}
          >
            <Field label="Topic area">
              <select value={niche} onChange={(e) => setNiche(e.target.value)}>
                {niches.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Specific question / working title">
              <input
                required
                minLength={8}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How do I undo the last Git commit safely?"
              />
            </Field>
            <Field label="Reader intent">
              <textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="What problem will this solve? What should the reader be able to do?"
              />
            </Field>
            <button className="primary" disabled={a.busy}>
              <Plus size={16} />
              Create planned article
            </button>
          </form>
        </section>
        <section className="panel padded">
          <div className="panel-heading">
            <h2>Explore topic proposals</h2>
            <Sparkles size={20} />
          </div>
          <p className="subtle">
            AI can propose specific questions and compare your existing topics.
            Suggestions are ideas, with no verified search-volume claims.
          </p>
          <Notice tone={integrations?.aiEnabled ? "info" : "warning"}>
            {integrations?.aiEnabled
              ? "Uses your configured model, with spending and daily limits."
              : "AI is disabled until you authorize billing and configure a provider key locally."}
          </Notice>
          <button
            className="secondary"
            disabled={a.busy || !integrations?.aiEnabled}
            onClick={() =>
              a.run(async () => {
                const result = await post<{
                  data: { topics: { title: string; intent: string }[] };
                }>("/ai/generate", { task: "topics", niche });
                setTopics(result.data.topics);
              })
            }
          >
            <Sparkles size={16} />
            Suggest topics
          </button>
          {topics.map((t) => (
            <button
              className="topic-proposal"
              key={t.title}
              onClick={() => {
                setTitle(t.title);
                setIntent(t.intent);
              }}
            >
              <strong>{t.title}</strong>
              <span>{t.intent}</span>
              <ArrowRight size={16} />
            </button>
          ))}
        </section>
      </div>
      <ContentBacklog notify={notify} />
    </>
  );
}
export function Generator({ notify, integrations }: ViewProps) {
  const r = useResource<Article[]>("/articles"),
    a = useAction(notify),
    router = useRouter();
  const [id, setId] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="AI, WITH EDITORIAL CARE"
        title="Article generator"
        description="Turn reviewed research into a draft, then bring your judgment and experience."
      />
      <div className="two-column">
        <section className="panel padded">
          <h2>Generate a source-based draft</h2>
          <p className="subtle">
            Add primary source links and claim-review notes to an article first.
            The backend retrieves bounded excerpts; it never claims to have
            verified the code.
          </p>
          <Field label="Article to draft">
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Choose an editable article</option>
              {r.data
                ?.filter((a) =>
                  [
                    "PLANNED",
                    "RESEARCHING",
                    "DRAFTING",
                    "NEEDS_REVIEW",
                    "FAILED",
                    "REJECTED",
                  ].includes(a.status),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>
          </Field>
          <Notice tone={integrations?.aiEnabled ? "info" : "warning"}>
            {integrations?.aiEnabled
              ? `Model: ${integrations.aiModel}. Monthly spend ceiling: ${money(integrations.aiMonthlyLimit)}.`
              : "Paid generation is disabled. Local drafting, research and review are available without API credits."}
          </Notice>
          <button
            className="primary"
            disabled={a.busy || !id || !integrations?.aiEnabled}
            onClick={() =>
              a.run(async () => {
                const article = r.data!.find((a) => a.id === id)!;
                await post("/ai/generate", {
                  task: "draft",
                  articleId: id,
                  niche: article.niche,
                });
                router.push("/articles/" + id);
              }, "AI draft saved for your review.")
            }
          >
            <Sparkles size={17} />
            {a.busy ? "Researching and drafting…" : "Generate draft"}
          </button>
        </section>
        <section className="panel padded">
          <h2>What the assistant prepares</h2>
          <div className="feature-checks">
            {[
              "Research context from your reviewed sources",
              "Structured outline and article HTML",
              "Descriptive excerpt and relevant labels",
              "Relevant internal links from existing posts",
              "Image search terms and uncertainty notes",
              "Workspace AI record and a required human review",
            ].map((v) => (
              <div key={v}>
                <Check size={17} />
                {v}
              </div>
            ))}
          </div>
          <Link className="text-link" href="/integrations">
            Configure the AI provider
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
export function Calendar({ notify, integrations }: ViewProps) {
  const r = useResource<Article[]>("/articles"),
    a = useAction(notify);
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [scheduleWhere, setScheduleWhere] = useState("blogger"),
    [day, setDay] = useState(""),
    [time, setTime] = useState("09:00");
  const now = new Date();
  const canCloud =
    integrations?.bloggerMode === "live" &&
    !!integrations.google?.liveTestSucceededAt;
  const cloudSchedule = canCloud && scheduleWhere === "blogger";
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const scheduled = (r.data?.filter((a) => a.scheduledAt) || []).sort(
    (a, b) =>
      new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
  );
  return (
    <>
      <PageHeading
        eyebrow="A STEADY RHYTHM"
        title="Publishing calendar"
        description="Schedule approved work. Times are always shown in Asia/Colombo."
      >
        <button
          className="secondary"
          disabled={a.busy}
          onClick={() =>
            a.run(async () => {
              const result = await post<{ results: { error?: string }[] }>(
                "/blogger/sync",
              );
              await r.reload();
              if (result.results.some((r) => r.error))
                throw new Error(
                  "Some Blogger statuses could not be confirmed. Open those articles for details.",
                );
            }, "Blogger schedules refreshed.")
          }
        >
          Sync Blogger status
        </button>
      </PageHeading>
      <ResourceState {...r} />
      <div className="two-column calendar-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {month.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="inline">
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => setOffset(offset - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="secondary compact"
                onClick={() => setOffset(0)}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => setOffset(offset + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div className="calendar-weekday" key={d}>
                {d}
              </div>
            ))}
            {Array.from({ length: month.getDay() }, (_, i) => (
              <div className="calendar-day blank" key={"b" + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${prefix}-${String(i + 1).padStart(2, "0")}`,
                items = scheduled.filter(
                  (a) =>
                    new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Colombo",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(a.scheduledAt!)) === date,
                );
              return (
                <button
                  className={"calendar-day " + (day === date ? "chosen" : "")}
                  key={i}
                  onClick={() => setDay(date)}
                >
                  <span>{i + 1}</span>
                  {items.map((a) => (
                    <span className="calendar-event" key={a.id}>
                      {a.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel padded">
          <h2>Schedule an approved article</h2>
          <Field label="Article">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose approved article</option>
              {r.data
                ?.filter(
                  (a) =>
                    a.status === "APPROVED" && a.publishingTarget !== "blogger",
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>
          </Field>
          {canCloud && (
            <Field label="Where to schedule">
              <select
                value={scheduleWhere}
                onChange={(e) => setScheduleWhere(e.target.value)}
              >
                <option value="blogger">
                  On Blogger · computer can be off
                </option>
                <option value="local">
                  On this computer · must stay running
                </option>
              </select>
            </Field>
          )}
          <Field label="Date">
            <input
              type="date"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label="Time · Asia/Colombo">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <button
            className="primary"
            disabled={a.busy || !selected || !day}
            onClick={() =>
              a.run(
                async () => {
                  await post(
                    (cloudSchedule ? "/blogger" : "") +
                      "/articles/" +
                      selected +
                      "/schedule",
                    {
                      at: new Date(`${day}T${time}:00+05:30`).toISOString(),
                    },
                  );
                  await r.reload();
                  setSelected("");
                },
                cloudSchedule
                  ? "Blogger confirmed the schedule. Your computer can be off."
                  : "Local publishing job saved.",
              )
            }
          >
            <CalendarDays size={16} />
            {cloudSchedule ? "Schedule on Blogger" : "Schedule article"}
          </button>
          <Notice>
            {cloudSchedule
              ? "Choose a time at least five minutes ahead. Studio sends the article now; Google handles the accepted schedule even when your computer is off. Local pause does not cancel it."
              : "This computer and Docker must stay running, and local automation must be resumed. Mock jobs create no real posts."}
          </Notice>
        </section>
      </div>
      <section className="panel spaced">
        <div className="panel-heading">
          <h2>Upcoming publications</h2>
          <Link className="text-link" href="/automation">
            Automation settings
            <ArrowRight size={14} />
          </Link>
        </div>
        {scheduled.length ? (
          <div className="stack-list">
            {scheduled.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <Link href={"/articles/" + item.id}>
                    <strong>{item.title}</strong>
                  </Link>
                  <p className="subtle small">
                    {formatDate(item.scheduledAt!, true)} · Asia/Colombo
                    {item.publishingTarget === "blogger"
                      ? " · Scheduled on Blogger · computer can be off"
                      : " · Scheduled on this computer"}
                  </p>
                  {item.remoteSyncError && (
                    <p className="warning-text small">{item.remoteSyncError}</p>
                  )}
                </div>
                {item.publishingTarget === "blogger" ? (
                  <a
                    className="secondary compact"
                    href={`https://www.blogger.com/blog/post/edit/${item.remoteBlogId}/${item.remotePostId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage on Blogger
                  </a>
                ) : (
                  <button
                    className="secondary compact"
                    disabled={a.busy}
                    onClick={() =>
                      a.run(async () => {
                        await post("/articles/" + item.id + "/unschedule");
                        await r.reload();
                      }, "Schedule canceled.")
                    }
                  >
                    Unschedule
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Your calendar has room to grow"
            description="Approve an article to add it to the publishing calendar."
          />
        )}
      </section>
    </>
  );
}
export function Automation({ notify }: ViewProps) {
  const r = useResource<Settings>("/settings"),
    a = useAction(notify);
  const [draft, setDraft] = useState<Settings | null>(null);
  const s = draft || r.data;
  async function save(value: Settings) {
    await api("/settings", {
      method: "PATCH",
      body: JSON.stringify({
        paused: value.paused,
        emergencyStop: value.emergencyStop,
        dailyLimit: value.dailyLimit,
        times: value.times.filter(Boolean),
      }),
    });
    setDraft(null);
    await r.reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="PUBLISHING ON YOUR TERMS"
        title="Automation"
        description="Your approved backlog powers automation. Quality always decides what can publish."
      />
      <ResourceState {...r} />
      <EditorialPipeline notify={notify} />
      {s && (
        <>
          <Notice>
            These controls manage publishing on this computer. They do not
            cancel schedules already accepted by Google. Manage those posts on
            Blogger, then sync their status in Studio.
          </Notice>
          <div className="two-column">
            <section className="panel padded">
              <div className="panel-heading">
                <h2>Publishing rhythm</h2>
                <Badge
                  value={
                    s.emergencyStop ? "STOPPED" : s.paused ? "PAUSED" : "ACTIVE"
                  }
                />
              </div>
              <Field label="Maximum articles per day">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={s.dailyLimit}
                  onChange={(e) =>
                    setDraft({ ...s, dailyLimit: Number(e.target.value) })
                  }
                />
              </Field>
              <Field
                label="Daily publishing times · Asia/Colombo"
                hint="A comma-separated list using 24-hour time. Example: 09:00, 17:00"
              >
                <input
                  value={s.times.join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...s,
                      times: e.target.value.split(",").map((t) => t.trim()),
                    })
                  }
                />
              </Field>
              <Notice>
                Recurrence fills the next seven days from approved articles. No
                drafts are published to meet a quota. PostgreSQL records survive
                application restarts.
              </Notice>
              <div className="form-actions">
                <button
                  className="secondary"
                  disabled={a.busy}
                  onClick={() =>
                    a.run(
                      () => save({ ...s, paused: !s.paused }),
                      s.paused ? "Automation resumed." : "Automation paused.",
                    )
                  }
                >
                  {s.paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                  {s.paused ? "Resume" : "Pause"} automation
                </button>
                <button
                  className="primary"
                  disabled={a.busy}
                  onClick={() =>
                    a.run(() => save(s), "Automation settings saved.")
                  }
                >
                  Save settings
                </button>
              </div>
            </section>
            <section className="panel padded">
              <div className="danger-icon">
                <ShieldCheck size={24} />
              </div>
              <h2>Emergency stop</h2>
              <p className="subtle">
                Stop new worker publications immediately. A remote request
                already in progress may finish; inspect job history before
                restarting.
              </p>
              <button
                className={s.emergencyStop ? "secondary" : "danger"}
                disabled={a.busy}
                onClick={() =>
                  a.run(
                    () =>
                      save({
                        ...s,
                        emergencyStop: !s.emergencyStop,
                        paused: true,
                      }),
                    s.emergencyStop
                      ? "Emergency stop cleared; automation remains paused."
                      : "Emergency stop enabled.",
                  )
                }
              >
                {s.emergencyStop
                  ? "Clear emergency stop"
                  : "Enable emergency stop"}
              </button>
              <div className="spaced">
                <Link href="/jobs" className="text-link">
                  Inspect queue and workers
                  <ArrowRight size={15} />
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
