import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma.service";
import { SearchConsoleService } from "./search-console.service";
import { ReportingService } from "./reporting.service";
import {
  automaticTrafficRange,
  nextTrafficSync,
  reportingRange,
  ReportReadError,
} from "../domain/reporting";
import { inspectionError } from "../domain/indexing";
@Injectable()
export class TrafficSyncService {
  constructor(
    private readonly db: PrismaService,
    private readonly search: SearchConsoleService,
    private readonly reporting: ReportingService,
  ) {}
  async status() {
    const configuration = await this.search.configuration();
    const where = { siteUrl: configuration.siteUrl || "" };
    const [history, lastSuccess] = await Promise.all([
      this.db.trafficSync.findMany({
        where,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: 20,
      }),
      this.db.trafficSync.findFirst({
        where: { ...where, state: { in: ["SUCCEEDED", "EMPTY"] } },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const automatic = await this.db.trafficSync.findFirst({
      where: { ...where, trigger: "automatic" },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });
    return {
      configuration,
      history,
      lastSuccess,
      lastAttempt: history[0] || null,
      nextAutomaticSyncAt: automatic
        ? nextTrafficSync(
            automatic.state,
            automatic.finishedAt || automatic.startedAt,
          )
        : null,
      note: "Daily search-traffic imports run while Studio is visible. An empty successful report means Google returned no rows, not zero traffic. Older saved data is retained on failure.",
    };
  }
  async sync(automatic: boolean, dates?: { start: string; end: string }) {
    const configuration = await this.search.configuration();
    if (!configuration.configured || !configuration.readAccess) {
      if (!automatic)
        throw new BadRequestException(
          "Select your verified property and connect Search Console read access in Blog connections.",
        );
      return {
        skipped: true,
        imported: 0,
        note: "Search Console setup is incomplete.",
        sync: null,
      };
    }
    if (!automatic && (!dates || !reportingRange(dates.start, dates.end)))
      throw new BadRequestException(
        "Choose valid calendar dates covering at most 93 days.",
      );
    const siteUrl = configuration.siteUrl!;
    const claim = await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172202)`;
        const cutoff = new Date(Date.now() - 15 * 60000);
        await tx.trafficSync.updateMany({
          where: { siteUrl, state: "RUNNING", startedAt: { lt: cutoff } },
          data: {
            state: "FAILED",
            finishedAt: new Date(),
            errorCode: "INTERRUPTED",
            errorMessage:
              "The previous import did not finish. Saved metrics are retained; a later import can safely retry.",
          },
        });
        const active = await tx.trafficSync.findFirst({
          where: { siteUrl, state: "RUNNING" },
          orderBy: { startedAt: "desc" },
        });
        if (active) return { run: active, start: false };
        const previousAutomatic = await tx.trafficSync.findFirst({
          where: { siteUrl, trigger: "automatic" },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        });
        if (
          automatic &&
          previousAutomatic &&
          previousAutomatic.errorCode !== "INTERRUPTED" &&
          nextTrafficSync(
            previousAutomatic.state,
            previousAutomatic.finishedAt || previousAutomatic.startedAt,
          ).getTime() > Date.now()
        )
          return { run: previousAutomatic, start: false };
        const bootstrap = !(await tx.trafficSync.findFirst({
          where: {
            siteUrl,
            trigger: "automatic",
            state: { in: ["SUCCEEDED", "EMPTY"] },
          },
        }));
        const range = automatic ? automaticTrafficRange(bootstrap) : dates!;
        const startDate = new Date(range.start + "T00:00:00Z"),
          endDate = new Date(range.end + "T00:00:00Z");
        if (!automatic) {
          const recent = await tx.trafficSync.findFirst({
            where: { siteUrl, startDate, endDate },
            orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          });
          const ttl =
            recent?.state === "FAILED"
              ? recent.errorCode === "QUOTA"
                ? 15 * 60000
                : 60000
              : 5 * 60000;
          if (
            recent &&
            recent.errorCode !== "INTERRUPTED" &&
            Date.now() - (recent.finishedAt || recent.startedAt).getTime() < ttl
          )
            return { run: recent, start: false };
        }
        return {
          run: await tx.trafficSync.create({
            data: {
              siteUrl,
              trigger: automatic ? "automatic" : "manual",
              state: "RUNNING",
              startDate,
              endDate,
            },
          }),
          start: true,
        };
      },
      { maxWait: 10000, timeout: 15000 },
    );
    let run = claim.run;
    if (claim.start) {
      try {
        const result = await this.reporting.searchConsole(
          run.startDate.toISOString().slice(0, 10),
          run.endDate.toISOString().slice(0, 10),
          siteUrl,
        );
        await this.db.trafficSync.updateMany({
          where: { id: run.id, state: "RUNNING" },
          data: {
            state: result.imported ? "SUCCEEDED" : "EMPTY",
            imported: result.imported,
            finishedAt: new Date(),
          },
        });
      } catch (error) {
        const safe =
          error instanceof ReportReadError
            ? { errorCode: error.code, errorMessage: error.message }
            : error instanceof BadRequestException
              ? {
                  errorCode: "INVALID_REPORT",
                  errorMessage:
                    "The report could not be imported. Check its date range and returned values; saved metrics are retained.",
                }
              : inspectionError(error);
        await this.db.trafficSync.updateMany({
          where: { id: run.id, state: "RUNNING" },
          data: { state: "FAILED", finishedAt: new Date(), ...safe },
        });
      }
      run = await this.db.trafficSync.findUniqueOrThrow({
        where: { id: run.id },
      });
    }
    if (!automatic && run.state === "FAILED")
      throw new BadRequestException(
        run.errorMessage || "Search traffic import failed.",
      );
    return {
      skipped: !claim.start,
      imported: run.imported,
      sync: run,
      note:
        run.state === "EMPTY"
          ? "Google returned no search rows for this period. Missing metrics remain unknown."
          : run.state === "RUNNING"
            ? "A search traffic import is already running. Saved results remain available."
            : run.state === "FAILED"
              ? run.errorMessage
              : "Actual search rows saved. Search Console may omit low-volume data and uses Pacific reporting dates.",
    };
  }
}
