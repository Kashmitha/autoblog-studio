import { allowedFrontendOrigins } from "../src/domain/origins";

describe("frontend origin allowlist", () => {
  test.each(["localhost", "127.0.0.1", "[::1]"])(
    "supports local browser aliases when configured with %s",
    (host) => {
      const allowed = allowedFrontendOrigins(`http://${host}:3100`, false);
      expect(allowed).toHaveLength(3);
      expect(allowed).toEqual(
        expect.arrayContaining([
          "http://localhost:3100",
          "http://127.0.0.1:3100",
          "http://[::1]:3100",
        ]),
      );
      for (const rejected of [
        "null",
        "http://localhost:3000",
        "https://localhost:3100",
        "http://127.0.0.2:3100",
        "https://evil.example",
        "http://localhost.evil.example:3100",
      ]) {
        expect(allowed).not.toContain(rejected);
      }
    },
  );
  test("production accepts only its configured origin, even for loopback", () => {
    expect(allowedFrontendOrigins("http://localhost:3100/", true)).toEqual([
      "http://localhost:3100",
    ]);
    expect(allowedFrontendOrigins("https://studio.example.com/", true)).toEqual(
      ["https://studio.example.com"],
    );
  });
  test("public development hosts do not gain loopback aliases", () => {
    expect(allowedFrontendOrigins("https://studio.example.com", false)).toEqual(
      ["https://studio.example.com"],
    );
  });
  test("normalizes surrounding whitespace and a trailing slash in configuration", () => {
    expect(allowedFrontendOrigins(" http://localhost:3100/ ", false)[0]).toBe(
      "http://localhost:3100",
    );
  });
  test.each([
    "file:///tmp/preview",
    "ftp://localhost:3100",
    "http://user:password@localhost:3100",
  ])("rejects invalid frontend configuration %s", (value) => {
    expect(() => allowedFrontendOrigins(value, false)).toThrow();
  });
});
