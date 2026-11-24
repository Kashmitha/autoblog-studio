import * as http from "../src/infrastructure/public-http";
import {
  clearResearchCache,
  officialResearchMirror,
  readResearchSource,
} from "../src/infrastructure/research-source";
beforeEach(() => clearResearchCache());
afterEach(() => jest.restoreAllMocks());
test("an unavailable MySQL page uses only the same-version official Oracle mirror and caches success", async () => {
  const raw = "https://dev.mysql.com/doc/refman/8.4/en/select.html";
  const mirror =
    "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/select.html";
  const get = jest
    .spyOn(http, "publicGet")
    .mockResolvedValueOnce({ status: 403, body: "Denied", url: raw })
    .mockResolvedValueOnce({
      status: 200,
      body: "Official manual ".repeat(20),
      url: mirror,
    });
  expect(await readResearchSource(raw)).toMatchObject({
    sourceUrl: mirror,
    status: 200,
  });
  await readResearchSource(raw);
  await readResearchSource(mirror);
  expect(get.mock.calls.map((args) => args[0])).toEqual([raw, mirror]);
  expect(
    officialResearchMirror(
      "https://dev.mysql.com.evil.test/doc/refman/8.4/en/select.html",
    ),
  ).toBeNull();
  expect(
    officialResearchMirror(
      "https://dev.mysql.com/doc/refman/8.0/en/select.html",
    ),
  ).toBeNull();
});
test("a denied unrelated source is not cached, substituted or silently accepted", async () => {
  const get = jest
    .spyOn(http, "publicGet")
    .mockResolvedValue({
      status: 403,
      body: "Denied",
      url: "https://fixture.example/doc",
    });
  await expect(
    readResearchSource("https://fixture.example/doc"),
  ).rejects.toThrow("temporarily unavailable");
  await expect(
    readResearchSource("https://fixture.example/doc"),
  ).rejects.toThrow();
  expect(get).toHaveBeenCalledTimes(2);
});
