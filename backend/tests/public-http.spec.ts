import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { publicHop, publicGet } from "../src/infrastructure/public-http";
jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
jest.mock("node:https", () => ({ request: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
test("private literals, IPv6, credentials and non-HTTPS requests never reach the network", async () => {
  for (const url of [
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://user:secret@example.com/",
    "http://example.com/",
    "https://example.com:444/",
  ])
    await expect(publicHop(url)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
});
test("mixed private/public DNS answers are rejected before any request", async () => {
  (lookup as jest.Mock).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]);
  await expect(publicHop("https://fixture.example/")).rejects.toThrow(
    "non-public",
  );
  expect(request).not.toHaveBeenCalled();
});
test("the request pins the validated IPv4 address and exposes only selected headers", async () => {
  (lookup as jest.Mock).mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  (request as jest.Mock).mockImplementation((_url, options, callback) => {
    expect(options.family).toBe(4);
    options.lookup(
      "fixture.example",
      {},
      (error: null, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe("8.8.8.8");
        expect(family).toBe(4);
      },
    );
    const req = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error: Error) => void;
    };
    req.destroy = (error) => req.emit("error", error) as unknown as void;
    req.end = () => {
      const res = new EventEmitter() as EventEmitter & {
        headers: Record<string, string>;
        statusCode: number;
      };
      res.headers = {
        "content-type": "text/html",
        "set-cookie": "SECRET_COOKIE",
      };
      res.statusCode = 200;
      callback(res);
      res.emit("data", Buffer.from("Hello"));
      res.emit("end");
    };
    return req;
  });
  const result = await publicHop("https://fixture.example/");
  expect(result.body).toBe("Hello");
  expect(JSON.stringify(result)).not.toContain("SECRET_COOKIE");
});
test("an editorial link redirect cannot bypass the same private-address protection", async () => {
  (lookup as jest.Mock).mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  (request as jest.Mock).mockImplementation((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error: Error) => void;
    };
    req.destroy = (error) => req.emit("error", error) as unknown as void;
    req.end = () => {
      const res = Object.assign(new EventEmitter(), {
        headers: { location: "https://127.0.0.1/private" },
        statusCode: 302,
      });
      callback(res);
      res.emit("end");
    };
    return req;
  });
  await expect(publicGet("https://fixture.example/")).rejects.toThrow(
    "Private",
  );
  expect(request).toHaveBeenCalledTimes(1);
});
