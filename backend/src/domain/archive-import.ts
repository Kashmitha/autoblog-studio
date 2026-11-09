import { createHash } from "node:crypto";
import { safeHtml } from "./quality";
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an archive object.");
  return value as Record<string, any>;
};
function string(value: unknown, field: string, max: number, min = 0) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    value.includes("\0")
  )
    throw new Error("Invalid " + field + ".");
  return value;
}
function list(value: unknown, field: string, max: number) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid " + field + ".");
  return value;
}
function bool(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error("Invalid " + field + ".");
  return value;
}
function unique(ids: string[], field: string) {
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate " + field + ".");
}
export function parseContentArchive(buffer: Buffer) {
  if (buffer.length > 20 * 1024 * 1024)
    throw new Error("Archive exceeds 20 MiB.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  let root: Record<string, any>;
  try {
    root = object(JSON.parse(text));
  } catch {
    throw new Error("Choose a valid Studio JSON content archive.");
  }
  if (root.format !== "autoblog-studio-content" || root.schemaVersion !== 1)
    throw new Error("Unsupported content archive format or version.");
  const media = list(root.media, "media", 2000).map((value) => {
    const m = object(value);
    const data = {
      title: string(m.title, "media title", 300, 1),
      alt: string(m.alt, "media alt", 2000),
      creator: string(m.creator, "creator", 1000),
      sourceUrl: string(m.sourceUrl, "media source", 2048),
      profileUrl:
        m.profileUrl == null ? null : string(m.profileUrl, "profile URL", 2048),
      license: string(m.license, "license", 1000),
      licenseUrl: string(m.licenseUrl, "license URL", 2048),
      attribution: string(m.attribution, "attribution", 5000),
    };
    const reference = {
      url: string(m.url, "media URL", 2048),
      provider: string(m.provider, "media provider", 80),
    };
    return {
      sourceId: string(m.id, "media ID", 200, 1),
      id: "archive-media-" + digest(JSON.stringify({ data, reference })),
      data,
      reference,
    };
  });
  unique(
    media.map((m) => m.sourceId),
    "media IDs",
  );
  const mediaIds = new Set(media.map((m) => m.sourceId));
  const articles = list(root.articles, "articles", 500).map((value) => {
    const a = object(value),
      original = string(a.html, "article HTML", 200000);
    const html = safeHtml(original, false);
    const labels = list(a.labels, "labels", 12).map((v) =>
      string(v, "label", 60, 1),
    );
    const sources = list(a.sources, "sources", 12)
      .map((value) => {
        const s = object(value),
          url = string(s.url, "source URL", 2048, 1);
        try {
          const u = new URL(url);
          if (u.protocol !== "https:" || u.username || u.password)
            throw new Error();
        } catch {
          throw new Error("Source URLs must be HTTPS without credentials.");
        }
        return {
          url,
          title: string(s.title, "source title", 300),
          note: string(s.note, "source note", 3000),
        };
      })
      .sort((a, b) => a.url.localeCompare(b.url));
    unique(
      sources.map((s) => s.url),
      "source URLs",
    );
    const refs = list(a.media, "article media", 20).map((m) =>
      string(object(m).mediaId, "media reference", 200, 1),
    );
    unique(refs, "article media references");
    if (refs.some((id) => !mediaIds.has(id)))
      throw new Error("An article references missing media.");
    const priority = a.backlogPriority;
    if (!Number.isInteger(priority) || priority < 0 || priority > 3)
      throw new Error("Invalid backlog priority.");
    const sourceId = string(a.id, "article ID", 200, 1),
      data = {
        title: string(a.title, "article title", 180, 8),
        niche: string(a.niche, "topic area", 80),
        intent: string(a.intent, "reader intent", 1000),
        excerpt: string(a.excerpt, "excerpt", 500),
        html,
        labels,
        planningNotes: string(a.planningNotes, "planning notes", 3000),
        backlogPriority: priority as number,
        aiAssisted: bool(a.aiAssisted, "AI provenance"),
        disclosure: bool(a.disclosure, "footer preference"),
      };
    const hash = digest(
      JSON.stringify({ sourceId, data, sources, media: refs.slice().sort() }),
    );
    return {
      sourceId,
      slug: "archive-" + hash,
      data,
      sources,
      media: refs,
      htmlAdjusted: html !== original,
    };
  });
  unique(
    articles.map((a) => a.sourceId),
    "article IDs",
  );
  const counts = object(root.counts);
  if (
    counts.articles !== articles.length ||
    counts.media !== media.length ||
    counts.sources !== articles.reduce((sum, a) => sum + a.sources.length, 0)
  )
    throw new Error("Archive counts do not match its contents.");
  return { fingerprint: digest(text), articles, media };
}
export type ParsedContentArchive = ReturnType<typeof parseContentArchive>;
