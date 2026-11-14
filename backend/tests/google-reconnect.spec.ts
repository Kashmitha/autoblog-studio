import {
  GoogleService,
  GoogleReconnectRequiredException,
} from "../src/infrastructure/blogger.service";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { encrypt, decrypt } from "../src/domain/security";

describe("Google refresh recovery", () => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY;
  const key = "12".repeat(32);
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = key;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = originalKey;
    jest.restoreAllMocks();
  });
  function fixture(failure?: unknown) {
    const tokens = {
      refresh_token: "fixture-refresh",
      access_token: "fixture-old",
      expiry_date: 1,
    };
    const encryptedTokens = encrypt(JSON.stringify(tokens), key);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      integration: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ encryptedTokens, blogId: "owned-blog" }),
        updateMany,
      },
    };
    const client = {
      setCredentials: jest.fn(),
      getAccessToken: failure
        ? jest.fn().mockRejectedValue(failure)
        : jest.fn().mockResolvedValue({ token: "fixture-new" }),
      credentials: { access_token: "fixture-new", expiry_date: 999999 },
    };
    const service = new GoogleService(db as unknown as PrismaService);
    jest
      .spyOn(service, "oauth")
      .mockReturnValue(client as unknown as ReturnType<GoogleService["oauth"]>);
    return { service, client, updateMany, encryptedTokens };
  }
  it("turns invalid_grant into actionable reconnect guidance without changing stored credentials", async () => {
    const f = fixture({
      response: {
        data: {
          error: "invalid_grant",
          error_description: "fixture provider detail",
        },
      },
    });
    const error = await f.service.client().catch((e) => e);
    expect(error).toBeInstanceOf(GoogleReconnectRequiredException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain("Reconnect Google");
    expect(error.message).not.toContain("fixture");
    expect(f.updateMany).not.toHaveBeenCalled();
  });
  it("does not mislabel temporary network errors as revoked consent", async () => {
    const cause = new Error("fixture network outage"),
      f = fixture(cause);
    await expect(f.service.client()).rejects.toBe(cause);
    expect(f.updateMany).not.toHaveBeenCalled();
  });
  it("retains normal encrypted refresh and its concurrent-grant protection", async () => {
    const f = fixture();
    await expect(f.service.client()).resolves.toBe(f.client);
    const saved = f.updateMany.mock.calls[0][0];
    expect(saved.where).toEqual({
      provider: "google",
      encryptedTokens: f.encryptedTokens,
    });
    expect(JSON.parse(decrypt(saved.data.encryptedTokens, key))).toMatchObject({
      refresh_token: "fixture-refresh",
      access_token: "fixture-new",
    });
    expect(saved.data).not.toHaveProperty("blogId");
  });
});
