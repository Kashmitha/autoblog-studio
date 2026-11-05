import { Injectable } from "@nestjs/common";
import { searchconsole } from "googleapis/build/src/apis/searchconsole";
import { webmasters } from "googleapis/build/src/apis/webmasters";
import { GoogleService } from "./blogger.service";
@Injectable()
export class SearchConsoleAdapter {
  constructor(private readonly google: GoogleService) {}
  async properties() {
    const api = webmasters({ version: "v3", auth: await this.google.client() });
    return (
      (await api.sites.list({}, { timeout: 20000, retry: false })).data
        .siteEntry || []
    );
  }
  async inspect(inspectionUrl: string, siteUrl: string) {
    const api = searchconsole({
      version: "v1",
      auth: await this.google.client(),
    });
    return (
      await api.urlInspection.index.inspect(
        { requestBody: { inspectionUrl, siteUrl, languageCode: "en-US" } },
        { timeout: 20000, retry: false },
      )
    ).data.inspectionResult;
  }
}
