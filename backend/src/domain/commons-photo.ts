import sanitizeHtml from "sanitize-html";

export type CommonsFile = {
  pageid?: number;
  title?: string;
  categories?: { title: string }[];
  imageinfo?: {
    url?: string;
    descriptionurl?: string;
    mime?: string;
    mediatype?: string;
    width?: number;
    height?: number;
    size?: number;
    sha1?: string;
    timestamp?: string;
    metadata?: { name: string; value: unknown }[];
    extmetadata?: Record<string, { value: string }>;
  }[];
};
export const commonsAutoEnabled = () =>
  process.env.COMMONS_AUTO_IMPORT === "true";
const plain = (s: string) =>
  sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
const techSubject =
  /\b(laptops?|computers?|keyboards?|workstations?|programmers?|servers?|networks?|electronics|monitors?|motherboards?|datacenter|data cent(?:er|re))\b/i;
const excluded =
  /\b(generated|generative|midjourney|dall.?e|stable diffusion|comfyui|synth(?:etic|ography)|illustration|rendering|renders?|screenshots?|logos?|diagrams?|paintings?|drawings?|nude|nudity|porn|casino|gambling)\b/i;

/** Only supported photographic subjects; model strings cannot become search operators. */
export function commonsPhotoQueries(terms: string[]) {
  return [
    ...new Set(
      terms
        .map((s) =>
          s
            .replace(/[^a-zA-Z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 70),
        )
        .filter((s) => techSubject.test(s) && !excluded.test(s)),
    ),
  ].slice(0, 2);
}
/** Conservative metadata evidence, not a human review or proof against forged metadata. */
export function inspectCommonsPhoto(page: CommonsFile, query: string) {
  const i = page.imageinfo?.[0];
  if (
    !i ||
    !Number.isSafeInteger(page.pageid) ||
    page.pageid! <= 0 ||
    i.mime !== "image/jpeg" ||
    i.mediatype !== "BITMAP" ||
    !i.url ||
    !i.sha1 ||
    !/^[a-z0-9]{31,40}$/i.test(i.sha1)
  )
    return null;
  let image: URL;
  try {
    image = new URL(i.url);
  } catch {
    return null;
  }
  if (
    image.protocol !== "https:" ||
    image.hostname !== "upload.wikimedia.org" ||
    image.username ||
    image.password ||
    image.port ||
    !image.pathname.startsWith("/wikipedia/commons/") ||
    !/\.jpe?g$/i.test(image.pathname)
  )
    return null;
  if (
    !i.width ||
    !i.height ||
    i.width < 1000 ||
    i.height < 600 ||
    i.width / i.height < 0.7 ||
    i.width / i.height > 2.5 ||
    !i.size ||
    i.size > 15000000
  )
    return null;
  const meta = i.extmetadata || {};
  const get = (name: string) => plain(meta[name]?.value || "");
  const text = [
    page.title,
    get("ObjectName"),
    get("ImageDescription"),
    get("Credit"),
    ...(page.categories?.map((c) => c.title) || []),
  ].join(" ");
  if (
    excluded.test(text) ||
    get("Restrictions") ||
    /\b(?:non.?commercial|no derivatives|fair use|permission required|copyright violation)\b/i.test(
      JSON.stringify(meta),
    )
  )
    return null;
  const queryWords = query.toLowerCase().match(/[a-z]{4,}/g) || [];
  const relevance = queryWords.filter((w) =>
    text.toLowerCase().includes(w),
  ).length;
  if (!techSubject.test(text) || !relevance) return null;
  const camera = Object.fromEntries(
    (i.metadata || []).map((m) => [m.name.toLowerCase(), m.value]),
  );
  const make = camera.make,
    model = camera.model;
  const capture = String(camera.datetimeoriginal || "");
  // Both the provider file revision and camera capture must predate modern text-to-image services.
  const capturedAt = Date.parse(
    capture.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T") +
      (/Z$/.test(capture) ? "" : "Z"),
  );
  const uploadedAt = Date.parse(i.timestamp || ""),
    cutoff = Date.parse("2022-01-01T00:00:00Z"),
    earliest = Date.parse("1980-01-01T00:00:00Z");
  if (
    typeof make !== "string" ||
    !make.trim() ||
    typeof model !== "string" ||
    !model.trim() ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(uploadedAt) ||
    capturedAt < earliest ||
    capturedAt >= cutoff ||
    uploadedAt < capturedAt ||
    uploadedAt >= cutoff
  )
    return null;
  const license = get("LicenseShortName");
  const licenses: Record<string, string> = {
    CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  };
  const licenseUrl = licenses[license];
  if (
    !licenseUrl ||
    get("LicenseUrl")
      .replace(/^http:/, "https:")
      .replace(/\/$/, "") !== licenseUrl.replace(/\/$/, "")
  )
    return null;
  const creator = get("Artist");
  if (
    creator.length < 2 ||
    creator.length > 200 ||
    /\b(?:unknown|anonymous)\b/i.test(creator)
  )
    return null;
  const title = plain(page.title || "")
    .replace(/^File:/, "")
    .slice(0, 200);
  return {
    title,
    url: image.href,
    alt: `Illustrative photograph: ${title.replace(/\.(jpg|jpeg)$/i, "").replace(/[_-]/g, " ")}`.slice(
      0,
      500,
    ),
    creator,
    sourceUrl: `https://commons.wikimedia.org/?curid=${page.pageid}`,
    provider: "WIKIMEDIA",
    license,
    licenseUrl,
    attribution: `Photo by ${creator} · ${license} · Wikimedia Commons. Illustrative photograph; not a screenshot of this tutorial.`,
    relevance,
    evidence: {
      pageId: page.pageid,
      sha1: i.sha1,
      make: make.slice(0, 100),
      model: model.slice(0, 100),
      capturedAt: new Date(capturedAt).toISOString(),
      fileRevisionAt: i.timestamp,
      query,
    },
  };
}
