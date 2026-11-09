"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAction } from "./hooks";
import { Notice, Field } from "./ui";
import type { Notify } from "./studio";
interface Preview {
  fingerprint: string;
  notice: string;
  articles: {
    sourceId: string;
    title: string;
    action: string;
    htmlAdjusted: boolean;
  }[];
  media: { sourceId: string; title: string; action: string }[];
}
interface Imported {
  createdArticles: number;
  createdMedia: number;
  skippedArticles: number;
  skippedMedia: number;
}
export function ContentImport({
  notify,
  onImported,
}: {
  notify: Notify;
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [result, setResult] = useState<Imported | null>(null),
    a = useAction(notify);
  const newArticles =
      preview?.articles.filter((x) => x.action === "create").length || 0,
    newMedia = preview?.media.filter((x) => x.action === "create").length || 0;
  return (
    <section
      className="panel padded spaced"
      aria-label="Import content archive"
    >
      <h2>Import content archive</h2>
      <p className="small subtle">
        Bring content into this installation as new drafts for review. Existing
        articles and media are never overwritten.
      </p>
      <Field label="Choose Studio JSON archive">
        <input
          type="file"
          accept=".json,application/json"
          disabled={a.busy}
          onChange={(e) => {
            setPreview(null);
            setResult(null);
            const selected = e.target.files?.[0] || null;
            if (selected && selected.size > 20 * 1024 * 1024) {
              setFile(null);
              notify("Choose an archive no larger than 20 MiB.", true);
            } else setFile(selected);
          }}
        />
      </Field>
      <button
        className="secondary"
        disabled={!file || a.busy}
        onClick={() =>
          a.run(async () => {
            const body = new FormData();
            body.append("file", file!);
            setPreview(null);
            setResult(null);
            setPreview(
              await api<Preview>("/content/archive/preview", {
                method: "POST",
                body,
              }),
            );
          })
        }
      >
        Preview archive import
      </button>
      {preview && (
        <>
          <Notice>{preview.notice}</Notice>
          <p>
            <strong>
              {newArticles} new review drafts · {newMedia} new media references
            </strong>
          </p>
          <p className="small subtle">
            {preview.articles.length - newArticles} articles and{" "}
            {preview.media.length - newMedia} media references already present;
            these will be skipped.
          </p>
          <details className="spaced">
            <summary>
              Preview article decisions ({preview.articles.length})
            </summary>
            {preview.articles.map((item) => (
              <p className="small break-url" key={item.sourceId}>
                <strong>{item.title}</strong> ·{" "}
                {item.action === "create"
                  ? "Create review draft"
                  : "Already present — skip"}
                {item.htmlAdjusted
                  ? " · HTML adjusted for safety / inline images removed"
                  : ""}
              </p>
            ))}
          </details>
          {!newArticles && !newMedia && (
            <p className="small">
              Everything in this archive is already present. Nothing needs to be
              imported.
            </p>
          )}
          <button
            className="primary"
            disabled={
              a.busy || !file || !!result || (!newArticles && !newMedia)
            }
            onClick={() =>
              a.run(async () => {
                const body = new FormData();
                body.append("file", file!);
                body.append("fingerprint", preview.fingerprint);
                const imported = await api<Imported>(
                  "/content/archive/import",
                  { method: "POST", body },
                );
                setResult(imported);
                await onImported();
              }, "Archive import completed. No publication was performed.")
            }
          >
            Import as review drafts
          </button>
        </>
      )}
      {result && (
        <Notice>
          Created {result.createdArticles} review drafts and{" "}
          {result.createdMedia} unreviewed media references. Skipped{" "}
          {result.skippedArticles} articles and {result.skippedMedia} media
          references already present.{" "}
          <Link className="text-link" href="/planner">
            Open content backlog
          </Link>
        </Notice>
      )}
      <p className="small subtle">
        Original image files are not in a content archive. Re-add those
        originals and review image rights and source links before approval. This
        does not restore accounts, credentials, schedules, live-post ownership
        or financial records.
      </p>
    </section>
  );
}
