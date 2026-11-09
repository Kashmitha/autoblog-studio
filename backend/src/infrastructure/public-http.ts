import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
export function publicV4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export interface PublicHop {
  status: number;
  body: string;
  url: string;
  headers: {
    location: string | null;
    contentType: string | null;
    robots: string | null;
    refresh: string | null;
  };
}
export async function publicHop(
  raw: string,
  userAgent = "AutoBlogStudio/0.1 (editorial link verification)",
  timeoutMs = 10000,
): Promise<PublicHop> {
  const deadline = Date.now() + Math.min(10000, Math.max(100, timeoutMs));
  if (raw.length > 2048) throw new Error("URL exceeds the supported length.");
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Only public HTTPS URLs on port 443 are allowed.");
  if (
    url.hostname.includes(":") ||
    (isIP(url.hostname) && !publicV4(url.hostname))
  )
    throw new Error("Private, local and IPv6 targets are not allowed.");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(
        () => reject(new Error("DNS lookup timed out.")),
        Math.max(1, deadline - Date.now()),
      );
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((a) => !publicV4(a.address)))
    throw new Error("The URL resolves to a non-public address.");
  return new Promise<PublicHop>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    const req = request(
      url,
      {
        family: 4,
        headers: {
          "User-Agent": userAgent,
          "Accept-Encoding": "identity",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, addresses[0].address, 4),
        timeout: Math.max(1, deadline - Date.now()),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            req.destroy(new Error("Response exceeds 2 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          clearTimeout(timer);
          const header = (name: string) => {
            const value = res.headers[name];
            return value === undefined
              ? null
              : (Array.isArray(value) ? value.join(", ") : value).slice(
                  0,
                  8000,
                );
          };
          resolve({
            status: res.statusCode || 500,
            body: Buffer.concat(chunks).toString("utf8"),
            url: url.href,
            headers: {
              location: header("location"),
              contentType: header("content-type"),
              robots: header("x-robots-tag"),
              refresh: header("refresh"),
            },
          });
        });
        res.on("error", fail);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", fail);
    timer = setTimeout(
      () => req.destroy(new Error("Request timed out.")),
      Math.max(1, deadline - Date.now()),
    );
    req.end();
  });
}
export async function publicGet(
  raw: string,
  redirects = 0,
): Promise<{ status: number; body: string; url: string }> {
  const result = await publicHop(raw);
  if (result.status >= 300 && result.status < 400 && result.headers.location) {
    if (redirects >= 4) throw new Error("Too many redirects.");
    return publicGet(
      new URL(result.headers.location, result.url).href,
      redirects + 1,
    );
  }
  return { status: result.status, body: result.body, url: result.url };
}
