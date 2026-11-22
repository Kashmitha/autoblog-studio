import { publicGet } from "./public-http";

export class ResearchSourceUnavailable extends Error {}
type ResearchRead = {
  status: number;
  body: string;
  sourceUrl: string;
  checkedAt: Date;
};
const cache = new Map<string, ResearchRead>();
export function clearResearchCache() {
  cache.clear();
}

/** Only this verified, same-version official mirror may replace a source. */
export function officialResearchMirror(raw: string) {
  const url = new URL(raw);
  const path = url.pathname.match(
    /^\/doc\/refman\/8\.4\/en\/([a-z0-9-]+\.html)$/,
  );
  return url.origin === "https://dev.mysql.com" && path && !url.search
    ? `https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/${path[1]}`
    : null;
}

/** Reuse only successful reads from this short preparation window. Never cache failures. */
export async function readResearchSource(raw: string): Promise<ResearchRead> {
  const saved = cache.get(raw);
  if (saved && Date.now() - saved.checkedAt.getTime() < 5 * 60000) return saved;
  const mirror = officialResearchMirror(raw);
  for (const sourceUrl of [raw, ...(mirror ? [mirror] : [])]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await publicGet(sourceUrl);
        if (result.status === 200 && result.body.length >= 80) {
          const read = {
            status: 200,
            body: result.body,
            sourceUrl,
            checkedAt: new Date(),
          };
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(raw, read);
          cache.set(sourceUrl, read);
          return read;
        }
        if (![429, 500, 502, 503, 504].includes(result.status)) break;
      } catch {
        /* Retry one transient network failure, retaining HTTPS/DNS protections. */
      }
      if (!attempt) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw new ResearchSourceUnavailable(
    `Research source temporarily unavailable: ${raw}`,
  );
}
