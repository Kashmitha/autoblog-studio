import { diagnosticTarget, pageMetadata } from "../src/domain/diagnostics";
import { DiagnosticFetcher } from "../src/infrastructure/diagnostic-fetcher";
import { publicHop } from "../src/infrastructure/public-http";
jest.mock("../src/infrastructure/public-http", () => ({
  publicHop: jest.fn(),
}));
const url = "https://fixture.blogspot.com/post.html";
const html = `<html><head><link href="${url}" rel="canonical"><meta name="robots" content="index,follow"></head><body>Article</body></html>`;
const response = (
  status: number,
  location: string | null = null,
  body = html,
) => ({
  status,
  url,
  body,
  headers: {
    location,
    contentType: "text/html; charset=UTF-8",
    robots: null,
    refresh: null,
  },
});
beforeEach(() => jest.resetAllMocks());
test("trace targets stay on the exact HTTPS origin without credentials or alternate ports", () => {
  expect(diagnosticTarget("/relative", new URL(url).origin)).toBeNull();
  for (const bad of [
    "http://fixture.blogspot.com/post",
    "https://fixture.blogspot.com.evil.test/post",
    "https://user:secret@fixture.blogspot.com/post",
    "https://fixture.blogspot.com:444/post",
    "javascript:alert(1)",
  ])
    expect(diagnosticTarget(bad, new URL(url).origin)).toBeNull();
  expect(diagnosticTarget(url + "#part", new URL(url).origin)).toBe(url);
});
test("metadata parsing handles attributes and entities without mistaking scripts, comments or templates for directives", () => {
  const body = `<html><head><!-- <meta name="robots" content="noindex"> --><script>const text='<meta name="robots" content="noindex">';</script><template><meta name="robots" content="noindex"></template><link REL=canonical href="/post.html?a=1&amp;b=2"></head><body>Text</body></html>`;
  const r = pageMetadata(body, url, url + "?a=1&b=2", null, null);
  expect(r.noindex).toBe(false);
  expect(r.canonicals).toEqual([url + "?a=1&b=2"]);
  expect(r.findings).toHaveLength(0);
});
test("noindex detection applies generic and Googlebot directives but not another named crawler", () => {
  expect(pageMetadata(html, url, url, "otherbot: noindex", null).noindex).toBe(
    false,
  );
  expect(
    pageMetadata(html, url, url, "googlebot: noindex, nofollow", null).noindex,
  ).toBe(true);
  expect(
    pageMetadata(
      html,
      url,
      url,
      "unavailable_after: 01 Jan 2027, noindex",
      null,
    ).noindex,
  ).toBe(true);
  expect(
    pageMetadata('<meta name="googlebot" content="NONE">', url, url, null, null)
      .noindex,
  ).toBe(true);
  const body = pageMetadata(
    '<html><head></head><body><meta name="robots" content="noindex"></body></html>',
    url,
    url,
    null,
    null,
  );
  expect(body.noindex).toBe(true);
  expect(body.findings.map((f) => f.code)).toContain("NOINDEX_FOUND");
});
test("canonical conflicts and refresh instructions are review findings rather than false indexing confirmations", () => {
  const r = pageMetadata(
    `<link rel=canonical href="${url}"><link rel=canonical href="/different"><meta http-equiv=refresh content="0;url=/elsewhere">`,
    url,
    url,
    null,
    "0;url=/elsewhere",
  );
  expect(r.findings.map((f) => f.code)).toEqual(
    expect.arrayContaining(["CANONICAL_CONFLICT", "REFRESH_FOUND"]),
  );
  expect(r.findings.every((f) => f.severity === "review")).toBe(true);
});
test("normal mobile routing is traced once without treating a matching clean canonical as an error", async () => {
  (publicHop as jest.Mock)
    .mockResolvedValueOnce(response(302, "?m=1"))
    .mockResolvedValueOnce(response(200));
  const r = await new DiagnosticFetcher().trace(
    "Mobile",
    url,
    url,
    "Fixture Mobile",
  );
  expect(r.hops.map((h) => h.status)).toEqual([302, 200]);
  expect(r.finalUrl).toBe(url + "?m=1");
  expect(r.findings).toHaveLength(0);
  expect(r.metadata?.noindex).toBe(false);
});
test("loops, missing redirect targets and outside-origin destinations stop without requesting unsafe destinations", async () => {
  (publicHop as jest.Mock).mockResolvedValue(response(302, url));
  const loop = await new DiagnosticFetcher().trace(
    "Mobile",
    url,
    url,
    "Fixture",
  );
  expect(loop.findings[0].code).toBe("REDIRECT_LOOP");
  expect(publicHop).toHaveBeenCalledTimes(1);
  (publicHop as jest.Mock)
    .mockReset()
    .mockResolvedValue(response(302, "http://127.0.0.1/private"));
  const outside = await new DiagnosticFetcher().trace(
    "Mobile",
    url,
    url,
    "Fixture",
  );
  expect(outside.findings[0].code).toBe("BLOCKED_REDIRECT");
  expect(publicHop).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(outside)).not.toContain("127.0.0.1");
  (publicHop as jest.Mock).mockReset().mockResolvedValue(response(302));
  expect(
    (await new DiagnosticFetcher().trace("Mobile", url, url, "Fixture"))
      .findings[0].code,
  ).toBe("MISSING_LOCATION");
});
test("Studio’s redirect bound is a review finding and network failures remain inconclusive", async () => {
  let count = 0;
  (publicHop as jest.Mock).mockImplementation(async () =>
    response(302, "?step=" + ++count),
  );
  const capped = await new DiagnosticFetcher().trace(
    "Mobile",
    url,
    url,
    "Fixture",
  );
  expect(capped.hops).toHaveLength(6);
  expect(capped.findings[0]).toMatchObject({
    code: "TRACE_LIMIT",
    severity: "review",
  });
  (publicHop as jest.Mock)
    .mockReset()
    .mockRejectedValue(new Error("SECRET_PRIVATE_PROVIDER_PAYLOAD"));
  const report = await new DiagnosticFetcher().check(url);
  expect(report.outcome).toBe("INCONCLUSIVE");
  expect(JSON.stringify(report)).not.toContain("SECRET");
  expect(report.scriptsExecuted).toBe(false);
});
test("a successful Studio fetch never becomes a Google indexing pass", async () => {
  (publicHop as jest.Mock).mockResolvedValue(response(200));
  const r = await new DiagnosticFetcher().check(url);
  expect(r.outcome).toBe("NO_ISSUE_REPRODUCED");
  expect(r.profiles).toHaveLength(4);
  expect(r.limitation).toContain("not Googlebot");
  expect(r).not.toHaveProperty("indexed");
});
