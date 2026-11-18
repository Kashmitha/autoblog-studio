import { Injectable } from "@nestjs/common";
import { analyticsdata } from "googleapis/build/src/apis/analyticsdata";
import { GoogleService } from "./blogger.service";

@Injectable()
export class AnalyticsAdapter {
  constructor(private readonly google: GoogleService) {}
  async audience(
    propertyId: string,
    host: string,
    start: string,
    end: string,
    dimension:
      "country" | "sessionSourceMedium" | "sessionCampaignName" | "pagePath",
  ) {
    const api = analyticsdata({
      version: "v1beta",
      auth: await this.google.client(),
    });
    return (
      await api.properties.runReport(
        {
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate: start, endDate: end }],
            dimensions: [{ name: dimension }],
            metrics: [
              { name: "sessions" },
              { name: "engagedSessions" },
              { name: "engagementRate" },
              { name: "screenPageViews" },
            ],
            dimensionFilter: {
              filter: {
                fieldName: "hostName",
                stringFilter: {
                  matchType: "EXACT",
                  value: host,
                  caseSensitive: false,
                },
              },
            },
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: "20",
          },
        },
        { timeout: 20000, retry: false },
      )
    ).data;
  }
  async report(
    propertyId: string,
    host: string,
    start: string,
    end: string,
    offset = 0,
    limit = 10000,
  ) {
    const api = analyticsdata({
      version: "v1beta",
      auth: await this.google.client(),
    });
    return (
      await api.properties.runReport(
        {
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate: start, endDate: end }],
            dimensions: [{ name: "date" }, { name: "pageLocation" }],
            metrics: [{ name: "screenPageViews" }],
            dimensionFilter: {
              filter: {
                fieldName: "hostName",
                stringFilter: {
                  matchType: "EXACT",
                  value: host,
                  caseSensitive: false,
                },
              },
            },
            orderBys: [
              { dimension: { dimensionName: "date" } },
              { dimension: { dimensionName: "pageLocation" } },
            ],
            limit: String(limit),
            offset: String(offset),
          },
        },
        { timeout: 30000, retry: false },
      )
    ).data;
  }
}
