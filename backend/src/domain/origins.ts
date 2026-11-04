const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Exact browser origins. Loopback aliases are available only for local development. */
export function allowedFrontendOrigins(
  configured: string,
  production: boolean,
): string[] {
  const url = new URL(configured.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "FRONTEND_URL must be an HTTP(S) origin without credentials.",
    );
  }
  const origins = new Set([url.origin]);
  if (!production && loopbackHosts.has(url.hostname)) {
    for (const hostname of loopbackHosts) {
      const alias = new URL(url.origin);
      alias.hostname = hostname;
      origins.add(alias.origin);
    }
  }
  return [...origins];
}
