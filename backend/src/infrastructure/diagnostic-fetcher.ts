import { Injectable } from "@nestjs/common";
import { publicHop } from "./public-http";
import { diagnosticTarget, pageMetadata, Finding } from "../domain/diagnostics";
export interface TraceProfile {
  name: string;
  hops: { url: string; status: number; location: string | null }[];
  finalUrl: string | null;
  status: number | null;
  error: string | null;
  findings: Finding[];
  metadata: ReturnType<typeof pageMetadata> | null;
}
const desktop =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 AutoBlogStudio/0.1";
const mobile =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 AutoBlogStudio/0.1";
@Injectable()
export class DiagnosticFetcher {
  async trace(
    name: string,
    start: string,
    expected: string,
    userAgent: string,
  ): Promise<TraceProfile> {
    const result: TraceProfile = {
      name,
      hops: [],
      finalUrl: null,
      status: null,
      error: null,
      findings: [],
      metadata: null,
    };
    const origin = new URL(expected).origin,
      visited = new Set<string>();
    let url = start;
    const deadline = Date.now() + 40000;
    try {
      for (let hop = 0; hop < 6; hop++) {
        if (visited.has(url)) {
          result.findings.push({
            code: "REDIRECT_LOOP",
            severity: "issue",
            message:
              "This request returned to a URL already visited in the same chain.",
          });
          break;
        }
        visited.add(url);
        if (Date.now() >= deadline) {
          result.error =
            "The diagnostic reached its time limit. No conclusion is available for this request.";
          break;
        }
        const response = await publicHop(
          url,
          userAgent,
          Math.min(8000, deadline - Date.now()),
        );
        result.status = response.status;
        result.finalUrl = url;
        const redirect = [301, 302, 303, 307, 308].includes(response.status);
        let next: string | null = null;
        if (redirect && response.headers.location) {
          try {
            next = new URL(response.headers.location, url).href;
          } catch {
            /* handled below */
          }
        }
        const safeNext = next ? diagnosticTarget(next, origin) : null;
        result.hops.push({ url, status: response.status, location: safeNext });
        if (redirect) {
          if (!response.headers.location) {
            result.findings.push({
              code: "MISSING_LOCATION",
              severity: "issue",
              message:
                "The server sent a redirect status without a destination.",
            });
            break;
          }
          if (!safeNext) {
            result.findings.push({
              code: "BLOCKED_REDIRECT",
              severity: "review",
              message:
                "The redirect destination is invalid, uses unsupported credentials/protocol/port, or leaves the selected blog. Studio did not request that destination.",
            });
            break;
          }
          if (hop === 5) {
            result.findings.push({
              code: "TRACE_LIMIT",
              severity: "review",
              message:
                "Studio stopped at its six-response limit. This is a diagnostic limit, not a confirmed Google redirect limit.",
            });
            break;
          }
          url = safeNext;
          continue;
        }
        if (response.status !== 200) {
          result.findings.push({
            code: "HTTP_STATUS",
            severity: "issue",
            message: `The article fetch returned HTTP ${response.status} instead of 200.`,
          });
          break;
        }
        if (
          !/text\/html|application\/xhtml\+xml/i.test(
            response.headers.contentType || "",
          )
        ) {
          result.findings.push({
            code: "NOT_HTML",
            severity: "review",
            message:
              "The response is not identified as HTML; page metadata was not assessed.",
          });
          break;
        }
        result.metadata = pageMetadata(
          response.body,
          url,
          expected,
          response.headers.robots,
          response.headers.refresh,
        );
        result.findings.push(...result.metadata.findings);
        break;
      }
    } catch {
      result.error =
        "The public HTTPS request could not complete within Studio’s address, response-size or time limits. This does not confirm a Google redirect failure.";
    }
    return result;
  }
  async check(url: string) {
    const cases: [string, string, string][] = [
      ["Desktop", url, desktop],
      ["Mobile", url, mobile],
    ];
    if (new URL(url).hostname.endsWith(".blogspot.com"))
      for (const mode of ["1", "0"]) {
        const variant = new URL(url);
        variant.searchParams.set("m", mode);
        cases.push([`Mobile · m=${mode}`, variant.href, mobile]);
      }
    const profiles = await Promise.all(
      cases.map(([name, start, agent]) => this.trace(name, start, url, agent)),
    );
    const outcome = profiles.some((p) =>
      p.findings.some((f) => f.severity === "issue"),
    )
      ? "ISSUE_OBSERVED"
      : profiles.some((p) => p.error)
        ? "INCONCLUSIVE"
        : profiles.some((p) => p.findings.length)
          ? "REVIEW_NEEDED"
          : "NO_ISSUE_REPRODUCED";
    return {
      outcome,
      profiles,
      scriptsExecuted: false,
      limitation:
        "These are bounded HTTP requests from Studio, not Googlebot or Google’s Test Live URL. JavaScript, ads, robots.txt and Google’s verified network are not tested. No issue reproduced does not mean indexing is confirmed or a previous crawl failure is fixed.",
    };
  }
}
