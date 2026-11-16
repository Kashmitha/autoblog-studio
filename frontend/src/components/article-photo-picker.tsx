"use client";
import { useState } from "react";
import Link from "next/link";
import type { Media } from "@/lib/types";
import { Field, Notice } from "./ui";

function publicLink(value: string) {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function ArticlePhotoPicker({
  photos,
  error,
  loading,
  busy,
  dirty,
  attachedIds,
  onAttach,
  onReload,
}: {
  photos: Media[] | null;
  error: string;
  loading: boolean;
  busy: boolean;
  dirty: boolean;
  attachedIds: string[];
  onAttach: (id: string) => void;
  onReload: () => void;
}) {
  const [query, setQuery] = useState(""),
    [provider, setProvider] = useState("ALL"),
    [selectedId, setSelectedId] = useState("");
  const available = (photos || []).filter(
    (photo) => photo.provider !== "ARCHIVE" && !attachedIds.includes(photo.id),
  );
  const visible = available.filter(
    (photo) =>
      (provider === "ALL" || photo.provider === provider) &&
      `${photo.title} ${photo.alt} ${photo.creator}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  // A filtered-out or newly attached selection must never remain attachable.
  const selected = visible.find((photo) => photo.id === selectedId);
  const blocked =
    busy ||
    dirty ||
    loading ||
    !!error ||
    !selected ||
    !selected.rightsConfirmed;
  return (
    <div
      className="article-photo-picker"
      aria-label="Choose article photo"
      role="region"
    >
      <p className="small subtle">
        Preview a library image and its credit before attaching it. Selecting or
        filtering does not change this article. Attaching adds an image;
        existing images stay in place.
      </p>
      <Field label="Find a library photo">
        <input
          type="search"
          maxLength={120}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, alt text or photographer"
        />
      </Field>
      <Field label="Photo provider">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="ALL">All providers</option>
          <option value="UNSPLASH">Unsplash · manual use</option>
          <option value="WIKIMEDIA">Wikimedia Commons</option>
          <option value="ORIGINAL">
            My original photographs / screenshots
          </option>
        </select>
      </Field>
      {error ? (
        <Notice tone="warning">
          Could not load the media library. Refresh it before attaching an
          image.
        </Notice>
      ) : loading ? (
        <p className="small subtle">Loading media library…</p>
      ) : (
        <p className="small subtle">
          {visible.length} matching images not already attached.
        </p>
      )}
      <button
        className="secondary compact"
        disabled={loading || busy}
        onClick={onReload}
      >
        Refresh media library
      </button>
      <Field label="Preview a library image">
        <select
          value={selected?.id || ""}
          disabled={loading || !!error || busy}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Choose an image to preview</option>
          {visible.map((photo) => (
            <option key={photo.id} value={photo.id}>
              {photo.title} · {photo.provider}
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <div className="article-photo-preview">
          <img src={selected.url} alt={selected.alt} />
          <strong>{selected.title}</strong>
          <p className="small">
            {selected.alt ||
              "Alt text is missing; update the media record before publication."}
          </p>
          <p className="small subtle">
            Creator: {selected.creator}. License: {selected.license}.
          </p>
          <p className="small">Credit: {selected.attribution}</p>
          <div className="inline wrap">
            {publicLink(selected.sourceUrl) && (
              <a
                className="text-link small"
                href={selected.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Original photo source
              </a>
            )}
            {publicLink(selected.licenseUrl) && (
              <a
                className="text-link small"
                href={selected.licenseUrl}
                target="_blank"
                rel="noreferrer"
              >
                License evidence
              </a>
            )}
          </div>
          {selected.provider === "UNSPLASH" && (
            <p className="small subtle">
              This Unsplash image can be manually attached here. It is excluded
              from the automatic photo pool.
            </p>
          )}
          {!selected.rightsConfirmed && (
            <Notice tone="warning">
              This image has no confirmed rights review. Review and import it in
              Media library first.
            </Notice>
          )}
          {!publicLink(selected.url) && (
            <Notice tone="warning">
              Private image: attaching it to a draft is allowed, but public
              HTTPS delivery must be configured before publication.
            </Notice>
          )}
        </div>
      )}
      {dirty && (
        <Notice tone="warning">
          Save your article changes before attaching a photo.
        </Notice>
      )}
      <button
        className="secondary wide"
        disabled={blocked}
        onClick={() => {
          if (selected && !blocked) onAttach(selected.id);
        }}
      >
        Attach selected image
      </button>
      {!loading && !error && !visible.length && (
        <p className="small subtle">
          Try another search/provider or import a reviewed image. Archived
          references must be re-imported before use.
        </p>
      )}
      <Link className="text-link small" href="/media">
        Import or review library images
      </Link>
    </div>
  );
}
