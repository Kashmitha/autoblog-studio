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
