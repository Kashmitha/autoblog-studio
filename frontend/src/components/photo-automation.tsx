"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, RefreshCw } from "lucide-react";
import { post } from "@/lib/api";
import { useResource } from "./hooks";
import { Notice } from "./ui";
import type { Notify } from "./studio";

type Row = {
  id: string;
  title: string;
  version: number;
  searchTerms: string[];
  state: string;
  image: null | {
    title: string;
    url: string;
    alt: string;
    attribution: string;
    sourceUrl: string;
  };
  lastAttempt: null | { code: string; message: string; at: string };
};
type Result = { state: string; message: string };

export function PrepareArticlePhoto({
  id,
  version,
  disabled,
  onPrepared,
  notify,
}: {
  id: string;
  version: number;
  disabled: boolean;
  onPrepared: () => Promise<unknown>;
  notify: Notify;
}) {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<Result | null>(null);
  return (
    <div className="spaced">
      <button
        className="secondary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setResult(null);
          try {
            const response = await post<Result>(
              `/editorial/articles/${id}/prepare-photo`,
              { version },
            );
            setResult(response);
            await onPrepared();
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ImagePlus size={18} />
        {busy ? "Finding a real photo…" : "Find and attach a real photo"}
      </button>
      <p className="small subtle">
        Uses an eligible library photo first, then Commons when enabled.
        Includes photo credit; no AI image generation or text-generation call.
      </p>
      {result && (
        <Notice tone={result.state === "BLOCKED" ? "warning" : "success"}>
          {result.message}
        </Notice>
      )}
    </div>
  );
}

export function PhotoAutomationQueue({ notify }: { notify: Notify }) {
  const r = useResource<{
    automaticDiscovery: boolean;
    hasMore: boolean;
    articles: Row[];
  }>("/editorial/photo-queue");
  const [busy, setBusy] = useState(false),
    [activeId, setActiveId] = useState(""),
    [results, setResults] = useState<Record<string, Result>>({});
  const [keywords, setKeywords] = useState<Record<string, string>>({});
  const stop = useRef(false);
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );
  const missing =
    r.data?.articles.filter((a) => a.state === "MISSING_IMAGE") || [];
  async function prepare(rows: Row[]) {
    if (busy) return;
    setBusy(true);
    stop.current = false;
    try {
      for (const row of rows.slice(0, 5)) {
        if (stop.current) break;
        setActiveId(row.id);
        try {
          const custom = keywords[row.id];
          const response = await post<Result>(
            `/editorial/articles/${row.id}/prepare-photo`,
            {
              version: row.version,
              ...(custom !== undefined
                ? {
                    keywords: custom
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 5),
                  }
                : {}),
            },
          );
          setResults((current) => ({ ...current, [row.id]: response }));
        } catch (e) {
          setResults((current) => ({
            ...current,
            [row.id]: { state: "BLOCKED", message: (e as Error).message },
          }));
        }
        await r.reload();
      }
    } finally {
      setActiveId("");
      setBusy(false);
      await r.reload();
    }
  }
  return (
    <section
      className="panel padded spaced"
      aria-label="Automatic photo preparation"
    >
      <div className="inline spread wrap">
        <div>
          <h2>Automatic photo preparation</h2>
          <p className="subtle">
            Real photographs for saved drafts, with attribution included.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void r.reload()}
        >
          <RefreshCw size={17} />
          Refresh photo queue
        </button>
      </div>
      <p>
        Prepare missing images without regenerating text. Approved, scheduled
        and published articles are excluded. The scheduled article workflow also
        requires an eligible image before it can proceed.
      </p>
      <p className="small subtle">
        Commons discovery:{" "}
        {r.data
          ? r.data.automaticDiscovery
            ? "enabled"
            : "disabled; eligible library photos only"
          : "checking…"}
        . Unsplash remains available for manual selection. Metadata checks
        cannot certify photographic origin or all rights.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.loading && !r.data && <p role="status">Loading photo queue…</p>}
      {r.data && (
        <>
          <div className="inline wrap spaced">
            <button
              className="primary"
              disabled={busy || !missing.length}
              onClick={() => void prepare(missing)}
            >
              <ImagePlus size={18} />
              {busy ? "Preparing photos…" : "Prepare up to 5 missing images"}
            </button>
            {busy && (
              <button
                className="secondary"
                onClick={() => {
                  stop.current = true;
                  notify("Stopping after the current photo attempt finishes.");
                }}
              >
                Stop after current photo
              </button>
            )}
            <span className="small subtle">
              {missing.length} drafts missing images in this queue
            </span>
          </div>
          {!r.data.articles.length && (
            <p>No editable saved drafts. Write or import an article first.</p>
          )}
          <div className="photo-preparation-list">
            {r.data.articles.map((row) => (
              <article key={row.id} className="photo-preparation-row">
                <div>
                  <Link className="article-title" href={`/articles/${row.id}`}>
                    {row.title}
                  </Link>
                  <p className="small subtle">
                    {row.state === "ATTACHED"
                      ? "Image attached — preview before approval"
                      : row.state === "NEEDS_TEXT"
                        ? "Save article text first"
                        : row.state === "WORKFLOW_BUSY"
                          ? "Scheduled workflow is preparing this draft"
                          : "Image needed"}
                  </p>
                  {row.state === "MISSING_IMAGE" && (
                    <label className="field">
                      <span>Photo keywords (comma-separated)</span>
                      <input
                        maxLength={200}
                        disabled={busy}
                        value={keywords[row.id] ?? row.searchTerms.join(", ")}
                        onChange={(e) =>
                          setKeywords((current) => ({
                            ...current,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  {(results[row.id] || row.lastAttempt) && (
                    <p role="status" className="small">
                      {results[row.id]?.message || row.lastAttempt?.message}
                    </p>
                  )}
                </div>
                {row.image ? (
                  <figure>
                    <img
                      loading="lazy"
                      src={row.image.url}
                      alt={row.image.alt}
                    />
                    <figcaption className="small subtle">
                      {row.image.attribution}{" "}
                      <a
                        className="text-link"
                        href={row.image.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source
                      </a>
                    </figcaption>
                  </figure>
                ) : (
                  <button
                    className="secondary"
                    disabled={busy || row.state !== "MISSING_IMAGE"}
                    onClick={() => void prepare([row])}
                  >
                    {activeId === row.id ? "Finding photo…" : "Prepare image"}
                  </button>
                )}
              </article>
            ))}
          </div>
          {r.data.hasMore && (
            <p className="small subtle">
              Showing the 50 most recently updated drafts. Individual article
              editors also support automatic photo preparation.
            </p>
          )}
        </>
      )}
      <p className="small subtle">
        Preparation attaches media only. It never approves, schedules or
        publishes an article, and never replaces an existing image.
      </p>
    </section>
  );
}
