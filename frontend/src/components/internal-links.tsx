"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAction } from "./hooks";
import { Notice } from "./ui";
import type { Notify } from "./studio";
interface Suggestion {
  id: string;
  title: string;
  url: string;
  sharedTerms: string[];
}
interface Suggestions {
  articleVersion: number;
  suggestions: Suggestion[];
  reason: string;
}
const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
function alreadyLinked(html: string, url: string) {
  if (typeof window === "undefined") return false;
  const normalize = (raw: string) => {
    try {
      const u = new URL(raw, url);
      u.hash = "";
      if (
        u.hostname.endsWith(".blogspot.com") &&
        ["0", "1"].includes(u.searchParams.get("m") || "")
      )
        u.searchParams.delete("m");
      return u.href;
    } catch {
      return null;
    }
  };
  return [
    ...new DOMParser()
      .parseFromString(html, "text/html")
      .querySelectorAll("a[href]"),
  ].some((a) => normalize(a.getAttribute("href")!) === normalize(url));
}
export function InternalLinks({
  id,
  version,
  html,
  locked,
  onInsert,
  notify,
}: {
  id: string;
  version: number;
  html: string;
  locked: boolean;
  onInsert: (html: string) => void;
  notify: Notify;
}) {
  const [data, setData] = useState<Suggestions | null>(null),
    a = useAction(notify);
  useEffect(() => setData(null), [id, version]);
  return (
    <section
      className="panel padded spaced"
      aria-label="Internal-link suggestions"
    >
      <h2>Related published posts</h2>
      <p className="small subtle">
        Find links using this article’s saved title, reader intent and labels.
        Save those fields first if you changed them.
      </p>
      <button
        className="secondary"
        disabled={a.busy}
        onClick={() =>
          a.run(async () =>
            setData(
              await api<Suggestions>("/articles/" + id + "/internal-links"),
            ),
          )
        }
      >
        Find related posts
      </button>
      {data && (
        <>
          <p className="small subtle">{data.reason}</p>
          {locked && (
            <Notice>
              This article is locked. Use suggestions when preparing a separate
              revision; its published body is unchanged.
            </Notice>
          )}
          {data.articleVersion !== version && (
            <Notice tone="warning">
              The article changed. Refresh the editor before using these
              suggestions.
            </Notice>
          )}
          {!data.suggestions.length && (
            <p className="small">
              No new related published posts found. Add specific labels and
              reader intent, or publish another relevant tutorial.
            </p>
          )}
          {data.suggestions.map((s) => {
            const linked = alreadyLinked(html, s.url);
            return (
              <div className="backlog-item" key={s.id}>
                <a
                  className="text-link small break-url"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.title}
                </a>
                <p className="small subtle">
                  Shared terms: {s.sharedTerms.join(", ")}
                </p>
                <p className="small break-url">{s.url}</p>
                <button
                  className="secondary compact"
                  disabled={
                    locked ||
                    linked ||
                    a.busy ||
                    data.articleVersion !== version
                  }
                  onClick={() => {
                    onInsert(
                      html +
                        '\n<p>Related reading: <a href="' +
                        escape(s.url) +
                        '">' +
                        escape(s.title) +
                        "</a>.</p>",
                    );
                    notify(
                      "Link added to the unsaved draft. Review its placement, then save and run quality checks.",
                    );
                  }}
                >
                  {linked ? "Already in draft" : "Add link to draft"}
                </button>
              </div>
            );
          })}
          <p className="small subtle">
            Matches are suggestions, not proof of relevance or indexing. Review
            the anchor text and placement. Saving a changed body resets
            approval.
          </p>
        </>
      )}
    </section>
  );
}
