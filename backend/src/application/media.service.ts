import { BadRequestException, Injectable } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";
import { PrismaService } from "../infrastructure/prisma.service";
import { MediaDto } from "../api/dtos";
@Injectable()
export class MediaService {
  constructor(private readonly db: PrismaService) {}
  async search(query: string, provider: string) {
    if (!query || query.length > 120)
      throw new BadRequestException(
        "Enter a search term of at most 120 characters.",
      );
    if (provider === "unsplash") {
      if (!process.env.UNSPLASH_ACCESS_KEY)
        throw new BadRequestException(
          "Set UNSPLASH_ACCESS_KEY in .env first; Wikimedia search needs no key.",
        );
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&content_filter=high`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!res.ok)
        throw new BadRequestException(`Unsplash returned HTTP ${res.status}.`);
      const data = (await res.json()) as {
        results: {
          id: string;
          urls: { regular: string };
          alt_description: string;
          description: string;
          user: { name: string; links: { html: string } };
          links: { html: string; download_location: string };
        }[];
      };
      return data.results.map((p) => ({
        title: p.description || p.alt_description || "Unsplash photograph",
        url: p.urls.regular,
        alt: p.alt_description || "",
        creator: p.user.name,
        sourceUrl:
          p.links.html + "?utm_source=autoblog_studio&utm_medium=referral",
        profileUrl:
          p.user.links.html + "?utm_source=autoblog_studio&utm_medium=referral",
        provider: "UNSPLASH",
        license: "Unsplash",
        licenseUrl: "https://unsplash.com/license",
        attribution: `Photo by ${p.user.name} on Unsplash`,
        rightsConfirmed: false,
        providerPhotoId: p.id,
      }));
    }
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "800",
    }).toString();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "AutoBlogStudio/0.1 (local editorial tool)" },
    });
    if (!res.ok) throw new BadRequestException("Wikimedia search unavailable.");
    const data = (await res.json()) as {
      query?: {
        pages: Record<
          string,
          {
            title: string;
            imageinfo?: {
              url: string;
              thumburl?: string;
              descriptionurl: string;
              extmetadata: Record<string, { value: string }>;
            }[];
          }
        >;
      };
    };
    return Object.values(data.query?.pages || {}).flatMap((p) => {
      const i = p.imageinfo?.[0];
      if (!i) return [];
      const text = (key: string) =>
        sanitizeHtml(i.extmetadata[key]?.value || "", {
          allowedTags: [],
          allowedAttributes: {},
        });
      const license = text("LicenseShortName");
      if (
        !["CC0", "CC BY 4.0", "CC BY-SA 4.0", "Public domain"].includes(
          license,
        ) ||
        !/^https:\/\//i.test(i.url) ||
        !/\.(jpg|jpeg|png|webp)$/i.test(new URL(i.url).pathname)
      )
        return [];
      const creator = text("Artist");
      return [
        {
          title: p.title.replace(/^File:/, ""),
          url: i.url,
          alt: "",
          creator,
          sourceUrl: i.descriptionurl,
          provider: "WIKIMEDIA",
          license,
          licenseUrl:
            text("LicenseUrl") ||
            "https://commons.wikimedia.org/wiki/Commons:Licensing",
          attribution: `${creator} · ${license} · Wikimedia Commons`,
          rightsConfirmed: false,
        },
      ];
    });
  }
  async add(dto: MediaDto) {
    if (!dto.rightsConfirmed)
      throw new BadRequestException(
        "Review commercial reuse rights and confirm the license before import.",
      );
    if (dto.provider === "UNSPLASH") {
      if (!process.env.UNSPLASH_ACCESS_KEY)
        throw new BadRequestException("Unsplash API key missing.");
      const id = dto.providerPhotoId;
      if (
        !id ||
        !/^[\w-]+$/.test(id) ||
        new URL(dto.sourceUrl).hostname !== "unsplash.com"
      )
        throw new BadRequestException(
          "Use an original Unsplash photo page URL.",
        );
      const response = await fetch(
        `https://api.unsplash.com/photos/${encodeURIComponent(id)}/download`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new BadRequestException(
          "Unsplash download-event tracking failed; image not imported.",
        );
      if (new URL(dto.url).hostname !== "images.unsplash.com")
        throw new BadRequestException("Preserve Unsplash image hotlink URLs.");
    }
    const { providerPhotoId, ...data } = dto;
    return this.db.mediaAsset.create({
      data: {
        ...data,
        metadata: {
          ...(providerPhotoId ? { providerPhotoId } : {}),
          licenseCheckedBy: "owner",
          checkedAt: new Date().toISOString(),
        },
      },
    });
  }
}
