import { BadRequestException } from "@nestjs/common";
import { MediaService } from "../src/application/media.service";
import { PrismaService } from "../src/infrastructure/prisma.service";
describe("licensed-provider selection", () => {
  test("Commons accepts a commercially reusable bitmap URL with provider query parameters", async () => {
    const service = new MediaService({} as PrismaService);
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  title: "File:Fixture laptop.jpg",
                  imageinfo: [
                    {
                      url: "https://upload.wikimedia.org/wikipedia/commons/test/laptop.jpg?utm_source=commons",
                      descriptionurl:
                        "https://commons.wikimedia.org/wiki/File:Fixture_laptop.jpg",
                      extmetadata: {
                        LicenseShortName: { value: "CC BY-SA 4.0" },
                        Artist: { value: "Fixture creator" },
                        LicenseUrl: {
                          value:
                            "https://creativecommons.org/licenses/by-sa/4.0/",
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const result = await service.search("laptop", "wikimedia");
    expect(result).toHaveLength(1);
    expect(result[0].rightsConfirmed).toBe(false);
    expect(result[0].url).toContain("?utm_source=commons");
  });
  const asset = {
    title: "Licensed test photograph",
    url: "https://images.unsplash.com/photo-test",
    alt: "A real photograph used as an isolated test fixture",
    creator: "Fixture Creator",
    sourceUrl: "https://unsplash.com/photos/example-photo-id",
    profileUrl: "https://unsplash.com/@fixture",
    provider: "UNSPLASH",
    providerPhotoId: "actual-photo-id",
    license: "Unsplash",
    licenseUrl: "https://unsplash.com/license",
    attribution: "Photo by Fixture Creator on Unsplash",
    rightsConfirmed: true,
  };
  afterEach(() => jest.restoreAllMocks());
  test("rejects unconfirmed commercial reuse rights", async () => {
    const service = new MediaService({} as PrismaService);
    await expect(
      service.add({ ...asset, rightsConfirmed: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  test("records a download event and stores actual creator metadata", async () => {
    const previous = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "isolated-test-no-network";
    const create = jest.fn().mockResolvedValue({ id: "asset" });
    const service = new MediaService({
      mediaAsset: { create },
    } as unknown as PrismaService);
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    try {
      await service.add(asset);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.unsplash.com/photos/actual-photo-id/download",
        expect.anything(),
      );
      const saved = create.mock.calls[0][0].data;
      expect(saved.creator).toBe("Fixture Creator");
      expect(saved.attribution).toContain("Fixture Creator");
      expect(saved.metadata.providerPhotoId).toBe("actual-photo-id");
    } finally {
      if (previous === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
      else process.env.UNSPLASH_ACCESS_KEY = previous;
    }
  });
  test("does not store an asset when download-event tracking fails", async () => {
    const previous = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "isolated-test-no-network";
    const create = jest.fn();
    const service = new MediaService({
      mediaAsset: { create },
    } as unknown as PrismaService);
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    try {
      await expect(service.add(asset)).rejects.toThrow("tracking failed");
      expect(create).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
      else process.env.UNSPLASH_ACCESS_KEY = previous;
    }
  });
});
