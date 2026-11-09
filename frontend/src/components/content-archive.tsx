"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { useAction, useResource } from "./hooks";
import { Notice } from "./ui";
import type { Notify } from "./studio";
import { ContentImport } from "./content-import";
interface Summary {
  articles: number;
  sources: number;
  media: number;
  withinCountLimits: boolean;
  limits: { articles: number; media: number; bytes: number };
  coverage: { included: string[]; excluded: string[]; limitation: string };
}
export function ContentArchive({ notify }: { notify: Notify }) {
  const r = useResource<Summary>("/content/archive"),
    a = useAction(notify),
    [downloaded, setDownloaded] = useState<string | null>(null);
  return (
    <>
      <section
        className="panel padded spaced"
        aria-label="Portable content archive"
      >
        <div className="panel-heading">
          <h2>Portable content archive</h2>
          <button
            className="secondary compact"
            disabled={a.busy}
            onClick={() => void r.reload()}
          >
            Refresh archive counts
          </button>
        </div>
        <p className="small subtle">
          GitHub holds the code. Download a separate copy of your saved article
          content and research notes here. Export reads saved data only.
        </p>
        {r.loading && <p role="status">Loading archive summary…</p>}
        {r.error && <Notice tone="warning">{r.error}</Notice>}
        {r.data && (
          <>
            <p>
              <strong>
                {r.data.articles} articles · {r.data.sources} sources ·{" "}
                {r.data.media} media references
              </strong>
            </p>
            <div className="two-column">
              <div>
                <h3>Included</h3>
                <ul className="help-list">
                  {r.data.coverage.included.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Kept separate</h3>
                <ul className="help-list">
                  {r.data.coverage.excluded.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Notice>{r.data.coverage.limitation}</Notice>
            <p className="small subtle">
              The download contains private writing and source notes. Keep it in
              your personal backup location. It is not uploaded to GitHub or
              another service by this action.
            </p>
            {!r.data.withinCountLimits && (
              <Notice tone="warning">
                Your workspace exceeds this export’s record limits. Use the
                database backup procedure for a complete copy.
              </Notice>
            )}
            <div className="inline wrap spaced">
              <button
                className="secondary"
                disabled={a.busy || !r.data.withinCountLimits}
                onClick={() =>
                  a.run(async () => {
                    const response = await fetch(
                      "/api/content/archive/export",
                      {
                        credentials: "same-origin",
                        cache: "no-store",
                      },
                    );
                    if (!response.ok) {
                      const error = await response.json().catch(() => null);
                      throw new Error(
                        typeof error?.message === "string"
                          ? error.message
                          : "The archive could not be downloaded. Your saved content is unchanged.",
                      );
                    }
                    const blob = await response.blob();
                    if (
                      !response.headers
                        .get("content-type")
                        ?.includes("application/json")
                    )
                      throw new Error(
                        "The server did not return a content archive. Sign in again and retry.",
                      );
                    const name =
                      response.headers
                        .get("content-disposition")
                        ?.match(
                          /filename="(autoblog-content-\d{4}-\d{2}-\d{2}\.json)"/,
                        )?.[1] || "autoblog-content.json";
                    const url = URL.createObjectURL(blob),
                      link = document.createElement("a");
                    link.href = url;
                    link.download = name;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
                    setDownloaded(new Date().toISOString());
                  }, "Content archive download started. Your saved articles are unchanged.")
                }
              >
                <Download size={15} />
                {a.busy ? "Preparing archive…" : "Download content archive"}
              </button>
            </div>
            <p className="small subtle">
              Limits: {r.data.limits.articles} articles, {r.data.limits.media}{" "}
              media references and{" "}
              {Math.floor(r.data.limits.bytes / 1024 / 1024)} MiB. Exports fail
              explicitly rather than silently omitting records.
            </p>
            {downloaded && (
              <p className="small subtle">
                Download requested this visit:{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Colombo",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(downloaded))}{" "}
                · Sri Lanka time. Confirm the file in your browser’s downloads.
              </p>
            )}
          </>
        )}
      </section>
      <ContentImport notify={notify} onImported={r.reload} />
    </>
  );
}
