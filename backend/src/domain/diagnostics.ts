import { Parser } from "htmlparser2";
export interface Finding {
  code: string;
  message: string;
  severity: "issue" | "review";
}
export function diagnosticTarget(raw: string, origin: string) {
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      url.origin === origin &&
      url.href.length <= 2048
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function pageMetadata(
  body: string,
  finalUrl: string,
  expectedUrl: string,
  headerRobots: string | null,
  refresh: string | null,
) {
  const canonicals: string[] = [],
    robots: { agent: string; content: string }[] = [],
    refreshes: string[] = [];
  let excluded = 0,
    outsideHead = false;
  const ignored = new Set(["template", "noscript", "svg", "math"]);
  const stack: string[] = [];
  const parser = new Parser(
    {
      onopentag(name, a) {
        stack.push(name);
        if (ignored.has(name)) excluded++;
        if (excluded) return;
        if (
          stack.includes("body") &&
          name === "link" &&
          (a.rel || "").toLowerCase().split(/\s+/).includes("canonical")
        ) {
          outsideHead = true;
          return;
        }
        if (
          name === "link" &&
          (a.rel || "").toLowerCase().split(/\s+/).includes("canonical") &&
          a.href &&
          canonicals.length < 10
        ) {
          try {
            const u = new URL(a.href, finalUrl);
            if (
              ["https:", "http:"].includes(u.protocol) &&
              !u.username &&
              !u.password
            )
              canonicals.push(u.href.slice(0, 2048));
          } catch {
            canonicals.push("Invalid canonical URL");
          }
        }
        if (name === "meta") {
          const agent = (a.name || "").toLowerCase();
          if (["robots", "googlebot"].includes(agent) && robots.length < 20)
            robots.push({ agent, content: (a.content || "").slice(0, 1000) });
          if (
            (a["http-equiv"] || "").toLowerCase() === "refresh" &&
            refreshes.length < 5
          )
            refreshes.push((a.content || "").slice(0, 1000));
        }
      },
      onclosetag(name) {
        const i = stack.lastIndexOf(name);
        if (i >= 0) {
          for (const removed of stack.splice(i))
            if (ignored.has(removed)) excluded--;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.end(body);
  if (headerRobots)
    robots.push({
      agent: "x-robots-tag",
      content: headerRobots.slice(0, 2000),
    });
  const blocked = (text: string) =>
    /(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(text);
  let headerBlocks = false,
    headerAgent = "";
  for (const part of (headerRobots || "").split(",")) {
    const tagged = part.trim().match(/^([a-z0-9*_-]+)\s*:\s*(.*)$/i);
    if (tagged && tagged[1].toLowerCase() !== "unavailable_after")
      headerAgent = tagged[1].toLowerCase();
    if (
      (!headerAgent || headerAgent === "googlebot" || headerAgent === "*") &&
      blocked(tagged ? tagged[2] : part)
    )
      headerBlocks = true;
  }
  const noindex =
    headerBlocks ||
    robots.some((r) => r.agent !== "x-robots-tag" && blocked(r.content));
  const findings: Finding[] = [];
  if (outsideHead)
    findings.push({
      code: "METADATA_OUTSIDE_HEAD",
      severity: "review",
      message:
        "A canonical link was found in the body. Verify the actual head and rendered page in Google’s live test.",
    });
  if (noindex)
    findings.push({
      code: "NOINDEX_FOUND",
      severity: "issue",
      message:
        "An indexing-blocking directive applies to general crawlers or Googlebot.",
    });
  if (refresh || refreshes.length)
    findings.push({
      code: "REFRESH_FOUND",
      severity: "review",
      message:
        "A Refresh header or meta refresh instruction is present. Review its target in Google’s rendered live test.",
    });
  const unique = [...new Set(canonicals)];
  if (!unique.length)
    findings.push({
      code: "CANONICAL_MISSING",
      severity: "review",
      message:
        "No canonical link was found in the returned HTML. This alone does not prevent indexing.",
    });
  else if (unique.length > 1)
    findings.push({
      code: "CANONICAL_CONFLICT",
      severity: "review",
      message: "The HTML declares more than one different canonical URL.",
    });
  else if (unique[0] !== expectedUrl)
    findings.push({
      code: "CANONICAL_DIFFERENT",
      severity: "review",
      message:
        "The declared canonical differs from the article’s saved public URL. Review the intended canonical before changing anything.",
    });
  return {
    canonicals: unique,
    robots,
    refreshHeader: refresh?.slice(0, 1000) || null,
    metaRefresh: refreshes,
    noindex,
    findings,
  };
}
