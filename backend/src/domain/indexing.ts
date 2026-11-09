export const automaticInspectionInterval = (state?: string | null) =>
  state === "ERROR" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

export function inspectionDue(
  last: { checkedAt: Date; state: string } | null,
  now = Date.now(),
) {
  return (
    !last ||
    now - last.checkedAt.getTime() >= automaticInspectionInterval(last.state)
  );
}

type Observation = {
  state: string;
  coverageState: string | null;
  pageFetchState: string | null;
  indexingState: string | null;
  lastCrawlTime: Date | null;
};
export function indexingFollowUp(
  published: boolean,
  blockedReason: string | null,
  latest: Observation | null,
  previous?: Observation | null,
) {
  const sameCrawl =
    !!latest?.lastCrawlTime &&
    !!previous?.lastCrawlTime &&
    latest.lastCrawlTime.getTime() === previous.lastCrawlTime.getTime();
  if (!published)
    return {
      category: "scheduled",
      title: "Awaiting publication",
      action:
        "Blogger must confirm publication before indexing can be checked.",
      sameCrawl: false,
    };
  if (blockedReason)
    return {
      category: "setup",
      title: "Connection needs attention",
      action: blockedReason,
      sameCrawl: false,
    };
  if (!latest)
    return {
      category: "unknown",
      title: "Awaiting a Google report",
      action: "Studio will read the stored report during its next daily check.",
      sameCrawl: false,
    };
  if (latest.state === "INDEXED")
    return {
      category: "indexed",
      title: "Indexing confirmed",
      action:
        "Google reports this URL indexed. Continue publishing useful articles; ranking and traffic are separate.",
      sameCrawl,
    };
  const fetchError =
    latest.pageFetchState &&
    !["SUCCESSFUL", "PAGE_FETCH_STATE_UNSPECIFIED"].includes(
      latest.pageFetchState,
    );
  const blocked =
    latest.indexingState &&
    !["INDEXING_ALLOWED", "INDEXING_STATE_UNSPECIFIED"].includes(
      latest.indexingState,
    );
  if (fetchError || blocked)
    return {
      category: "attention",
      title:
        latest.pageFetchState === "REDIRECT_ERROR"
          ? "Investigate the recorded redirect error"
          : "Review Google's recorded access issue",
      action: sameCrawl
        ? "Google is reporting the same crawl again, not a new crawl failure. Open Search Console for this URL and compare a fresh Test Live URL result with the recorded crawl."
        : "Open Search Console for this URL and run Test Live URL. Investigate the reported access issue before changing settings.",
      sameCrawl,
    };
  const coverage = latest.coverageState?.toLowerCase() || "";
  if (coverage.includes("discovered") && coverage.includes("not indexed"))
    return {
      category: "waiting",
      title: "Waiting for Google's crawl",
      action:
        "Google has discovered this URL but reports no completed crawl yet. Keep the published URL stable; a manual indexing request is optional.",
      sameCrawl,
    };
  if (coverage.includes("crawled") && coverage.includes("not indexed"))
    return {
      category: "waiting",
      title: "Crawled; indexing not confirmed",
      action:
        "Google fetched this URL but has not indexed it. Review the article's usefulness, internal links and canonical details if this persists.",
      sameCrawl,
    };
  return {
    category: "attention",
    title: "Review Google's indexing reason",
    action:
      "Open Search Console for this exact URL and review its coverage and canonical details. A successful live test alone does not confirm indexing.",
    sameCrawl,
  };
}

export function validSearchProperty(site: string) {
  if (site.startsWith("sc-domain:"))
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(
      site.slice(10),
    );
  try {
    const u = new URL(site);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}
export function urlInProperty(url: string, site: string) {
  if (!validSearchProperty(site)) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.hash)
      return false;
    if (site.startsWith("sc-domain:")) {
      const domain = site.slice(10).toLowerCase();
      return u.hostname === domain || u.hostname.endsWith("." + domain);
    }
    const p = new URL(site);
    return u.origin === p.origin && u.href.startsWith(p.href);
  } catch {
    return false;
  }
}
export function indexVerdict(verdict?: string | null) {
  if (verdict === "PASS") return "INDEXED" as const;
  if (verdict === "FAIL" || verdict === "NEUTRAL")
    return "NOT_INDEXED" as const;
  return "UNKNOWN" as const;
}
export function safeInspectionLink(link?: string | null) {
  try {
    const u = new URL(link || "");
    return u.protocol === "https:" &&
      u.hostname === "search.google.com" &&
      u.pathname.startsWith("/search-console/") &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function inspectionError(error: unknown) {
  const e = error as {
    code?: number | string;
    response?: {
      status?: number;
      data?: {
        error?: {
          errors?: { reason?: string }[];
          details?: { reason?: string }[];
        };
      };
    };
  };
  const status = e?.response?.status || Number(e?.code);
  const reasons = [
    ...(e?.response?.data?.error?.errors || []),
    ...(e?.response?.data?.error?.details || []),
  ].map((r) => r.reason);
  if (status === 401)
    return {
      errorCode: "AUTH_REQUIRED",
      errorMessage:
        "Google sign-in needs refreshing. Reconnect read access in Blog connections.",
    };
  if (
    reasons.some((r) => r === "accessNotConfigured" || r === "SERVICE_DISABLED")
  )
    return {
      errorCode: "API_DISABLED",
      errorMessage:
        "Enable Search Console API in your existing Google Cloud project, then try again.",
    };
  if (status === 403)
    return {
      errorCode: "ACCESS_DENIED",
      errorMessage:
        "Google denied access. Check read-only permission, API availability and access to the selected property.",
    };
  if (status === 429)
    return {
      errorCode: "QUOTA",
      errorMessage:
        "Google's inspection quota was reached. Wait before checking again; your previous result is retained.",
    };
  return {
    errorCode: "GOOGLE_UNAVAILABLE",
    errorMessage:
      "Google could not return a result. Your previous inspection is retained; try again later.",
  };
}
