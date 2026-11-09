"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAction, useResource } from "./hooks";
import { Badge, Field, Notice } from "./ui";
import type { Notify } from "./studio";
import type { Status } from "@/lib/types";
interface Plan {
  id: string;
  title: string;
  niche: string;
  intent: string;
  status: Status;
  backlogPriority: number;
  planningNotes: string;
  planningVersion: number;
  hasDraft: boolean;
  sourceCount: number;
  checkedSourceCount: number;
  qualityPassed: boolean;
}
const priorities = ["Not set", "Low", "Medium", "High"];
function BacklogItem({
  item,
  notify,
  reload,
}: {
  item: Plan;
  notify: Notify;
  reload: () => Promise<void>;
}) {
  const [priority, setPriority] = useState(item.backlogPriority),
    [notes, setNotes] = useState(item.planningNotes),
    a = useAction(notify);
  return (
    <article className="backlog-item">
      <div className="inline wrap">
        <Badge value={item.status} />
        <span className="small subtle">
          {priorities[item.backlogPriority]} priority · {item.niche}
        </span>
      </div>
      <h3>
        <Link href={"/articles/" + item.id}>{item.title}</Link>
      </h3>
      <p className="small break-url">
        {item.intent || "Add a specific reader problem in the article editor."}
      </p>
      <p className="small subtle">
        {item.hasDraft ? "Draft present" : "No draft yet"} ·{" "}
        {item.checkedSourceCount}/{item.sourceCount} sources checked with
        support notes ·{" "}
        {item.qualityPassed
          ? "Current quality checks passed"
          : "Quality review needed"}
      </p>
      <details>
        <summary>Priority and private notes</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await api("/articles/" + item.id + "/planning", {
                method: "PATCH",
                body: JSON.stringify({
                  backlogPriority: priority,
                  planningNotes: notes,
                  planningVersion: item.planningVersion,
                }),
              });
              await reload();
            }, "Plan saved. Article content and approval unchanged.");
          }}
        >
          <Field label={"Priority for " + item.title}>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              {priorities.map((label, value) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={"Private notes for " + item.title}>
            <textarea
              maxLength={3000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What to test, examples to capture, and sources to review."
            />
          </Field>
          <p className="small subtle">
            Workspace notes only; these are never sent to Blogger.
          </p>
          <button
            className="secondary"
            disabled={
              a.busy ||
              (priority === item.backlogPriority &&
                notes === item.planningNotes)
            }
          >
            Save plan
          </button>
        </form>
      </details>
      <Link className="text-link small" href={"/articles/" + item.id}>
        Open article →
      </Link>
    </article>
  );
}
export function ContentBacklog({ notify }: { notify: Notify }) {
  const r = useResource<{ articles: Plan[] }>("/articles/backlog");
  const [query, setQuery] = useState(""),
    [stage, setStage] = useState("all"),
    [priority, setPriority] = useState("all");
  const articles = r.data?.articles || [],
    visible = articles.filter(
      (item) =>
        (stage === "all" || item.status === stage) &&
        (priority === "all" || String(item.backlogPriority) === priority) &&
        [item.title, item.niche, item.intent, item.planningNotes].some((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
    );
  return (
    <section className="panel padded spaced" aria-label="Content backlog">
      <div className="panel-heading">
        <h2>Content backlog</h2>
        <button className="secondary compact" onClick={() => void r.reload()}>
          Refresh backlog
        </button>
      </div>
      <p className="small subtle">
        Plan → write → review → approve. Highest priority comes first, then
        oldest idea. Scheduling still requires your editorial approval.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.loading && <p role="status">Loading backlog…</p>}
      <div className="backlog-filters">
        <Field label="Search backlog">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, reader problem or notes"
          />
        </Field>
        <Field label="Backlog stage">
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All stages</option>
            {[
              "PLANNED",
              "RESEARCHING",
              "DRAFTING",
              "NEEDS_REVIEW",
              "APPROVED",
            ].map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Backlog priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            {priorities.map((p, i) => (
              <option key={i} value={i}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {r.data && (
        <p className="small subtle">
          {visible.length} of {articles.length} backlog articles ·{" "}
          {articles.filter((x) => x.status === "APPROVED").length} approved
        </p>
      )}
      {r.data && visible.length === 0 && (
        <p>
          {articles.length
            ? "No articles match these filters."
            : "Your backlog is clear. Add a focused question above to plan the next tutorial."}
        </p>
      )}
      {visible.map((item) => (
        <BacklogItem
          key={item.id + ":" + item.planningVersion}
          item={item}
          notify={notify}
          reload={r.reload}
        />
      ))}
    </section>
  );
}
