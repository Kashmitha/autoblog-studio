import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import { DiagnosticFetcher } from "../infrastructure/diagnostic-fetcher";
import { SearchConsoleService } from "./search-console.service";
import { diagnosticTarget } from "../domain/diagnostics";
@Injectable()
export class FetchDiagnosticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly fetcher: DiagnosticFetcher,
    private readonly search: SearchConsoleService,
  ) {}
  private async readiness(id: string) {
    const [article, connection] = await Promise.all([
      this.db.article.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, publishedUrl: true },
      }),
      this.db.integration.findUnique({
        where: { provider: "google" },
        select: { blogUrl: true },
      }),
    ]);
    if (!article) throw new NotFoundException("Article not found.");
    let ownedOrigin: string | null = null;
    try {
      ownedOrigin = connection?.blogUrl
        ? new URL(connection.blogUrl).origin
        : null;
    } catch {
      /* incomplete connection */
    }
    const eligible = article.status === "PUBLISHED" && !!article.publishedUrl;
    const blockedReason = !eligible
      ? "Blogger must confirm publication before live fetch checks."
      : !ownedOrigin
        ? "Select your owned Blogger blog in Blog connections first."
        : !diagnosticTarget(article.publishedUrl!, ownedOrigin)
          ? "The saved public URL must be HTTPS on the selected blog. Review its connection before checking."
          : null;
    return { article, eligible, canCheck: !blockedReason, blockedReason };
  }
  async report(id: string) {
    const ready = await this.readiness(id);
    const [history, indexing] = await Promise.all([
      this.db.fetchDiagnostic.findMany({
        where: { articleId: id, url: ready.article.publishedUrl || "" },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
      this.search.report(id),
    ]);
    const latest = history[0] || null;
    return {
      ...ready,
      latest,
      history,
      nextCheckAt: latest
        ? new Date(
            (latest.finishedAt || latest.startedAt).getTime() +
              (latest.state === "RUNNING"
                ? 120000
                : latest.state === "FAILED"
                  ? 60000
                  : 15 * 60000),
          )
        : null,
      google: indexing.latest
        ? {
            state: indexing.latest.state,
            coverageState: indexing.latest.coverageState,
            lastCrawlTime: indexing.latest.lastCrawlTime,
            checkedAt: indexing.latest.checkedAt,
            inspectionResultLink: indexing.latest.inspectionResultLink,
          }
        : null,
    };
  }
  async run(id: string) {
    const ready = await this.readiness(id);
    if (ready.blockedReason) throw new BadRequestException(ready.blockedReason);
    const url = ready.article.publishedUrl!;
    const claim = await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172203)`;
        const latest = await tx.fetchDiagnostic.findFirst({
          where: { articleId: id, url },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        });
        if (latest) {
          const age =
            Date.now() - (latest.finishedAt || latest.startedAt).getTime();
          if (
            age <
            (latest.state === "RUNNING"
              ? 120000
              : latest.state === "FAILED"
                ? 60000
                : 15 * 60000)
          )
            return { run: latest, start: false };
          if (latest.state === "RUNNING")
            await tx.fetchDiagnostic.update({
              where: { id: latest.id },
              data: {
                state: "FAILED",
                finishedAt: new Date(),
                errorMessage:
                  "The previous check did not finish. This attempt was stopped before a result was confirmed.",
              },
            });
        }
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        if (
          (await tx.fetchDiagnostic.count({
            where: { startedAt: { gte: day } },
          })) >= 20
        )
          throw new BadRequestException(
            "Studio’s daily live-fetch diagnostic limit is reached. Saved reports are still available.",
          );
        return {
          run: await tx.fetchDiagnostic.create({
            data: { articleId: id, url, state: "RUNNING" },
          }),
          start: true,
        };
      },
      { maxWait: 10000, timeout: 15000 },
    );
    if (claim.start) {
      try {
        const [trace, indexing] = await Promise.all([
          this.fetcher.check(url),
          this.search.report(id),
        ]);
        const current = await this.readiness(id);
        if (!current.canCheck || current.article.publishedUrl !== url)
          throw new Error("Publishing state changed");
        const result = {
          ...trace,
          checkedAt: new Date().toISOString(),
          url,
          googleAtCheck: indexing.latest
            ? {
                state: indexing.latest.state,
                coverageState: indexing.latest.coverageState,
                lastCrawlTime:
                  indexing.latest.lastCrawlTime?.toISOString() || null,
                receivedAt: indexing.latest.checkedAt.toISOString(),
              }
            : null,
        };
        await this.db.fetchDiagnostic.updateMany({
          where: { id: claim.run.id, state: "RUNNING" },
          data: {
            state: "COMPLETED",
            result: result as unknown as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        });
      } catch {
        await this.db.fetchDiagnostic.updateMany({
          where: { id: claim.run.id, state: "RUNNING" },
          data: {
            state: "FAILED",
            finishedAt: new Date(),
            errorMessage:
              "The diagnostic could not complete or the article connection changed. Your Google indexing report and publication are unchanged.",
          },
        });
      }
    }
    return { ...(await this.report(id)), cached: !claim.start };
  }
}
