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
export async function publicGet(
  raw: string,
  redirects = 0,
): Promise<{ status: number; body: string; url: string }> {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Only public HTTPS URLs on port 443 are allowed.");
  if (isIP(url.hostname) && !publicV4(url.hostname))
    throw new Error("Private, local and IPv6 targets are not allowed.");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicV4(a.address)))
    throw new Error("The URL resolves to a non-public address.");
  const result = await new Promise<{
    status: number;
    body: string;
    location?: string;
  }>((resolve, reject) => {
    const req = request(
      url,
      {
        family: 4,
        headers: {
          "User-Agent": "AutoBlogStudio/0.1 (editorial link verification)",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, addresses[0].address, 4),
        timeout: 10000,
      },
      (res) => {
        let body = "";
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            req.destroy(new Error("Response exceeds 2 MB."));
            return;
          }
          body += chunk.toString("utf8");
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 500,
            body,
            location: res.headers.location,
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", reject);
    req.end();
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    if (redirects >= 4) throw new Error("Too many redirects.");
    return publicGet(new URL(result.location, url).href, redirects + 1);
  }
  return { status: result.status, body: result.body, url: url.href };
}
