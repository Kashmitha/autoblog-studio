import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";
import { SessionGuard } from "./auth";
import { SearchConsoleService } from "../application/search-console.service";
class PropertyDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MaxLength(2048)
  siteUrl!: string;
}
@Controller("seo")
@UseGuards(SessionGuard)
export class SearchConsoleController {
  constructor(private readonly search: SearchConsoleService) {}
  @Get("search-console") configuration() {
    return this.search.configuration();
  }
  @Get("search-console/properties") properties() {
    return this.search.properties();
  }
  @Post("search-console/property") save(@Body() d: PropertyDto) {
    return this.search.saveProperty(d.siteUrl);
  }
  @Get("indexing") overview() {
    return this.search.overview();
  }
  @Get("articles/:id/indexing") report(@Param("id") id: string) {
    return this.search.report(id);
  }
  @Post("articles/:id/inspect") inspect(@Param("id") id: string) {
    return this.search.inspect(id);
  }
}
