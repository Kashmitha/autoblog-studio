import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { EditorialService } from "../application/editorial.service";
import { SessionGuard } from "./auth";
class EditorialSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsBoolean() autoPublish!: boolean;
  @IsOptional() @IsBoolean() autoPlan?: boolean;
  @IsInt() @Min(0) revision!: number;
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  times!: string[];
  @IsString() @MaxLength(100) confirmation!: string;
}
class PhotoPoolDto {
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags!: string[];
  @IsString() @MaxLength(100) confirmation!: string;
}
@Controller("editorial")
@UseGuards(SessionGuard)
export class EditorialController {
  constructor(private readonly editorial: EditorialService) {}
  @Get() @Header("Cache-Control", "no-store") status() {
    return this.editorial.status();
  }
  @Patch() save(@Body() input: EditorialSettingsDto) {
    return this.editorial.save(input);
  }
  @Post("starter-briefs") starters() {
    return this.editorial.starters();
  }
  @Post("queue") queue() {
    return this.editorial.queue();
  }
  @Post("runs/:id/resume-photo") resume(@Param("id") id: string) {
    return this.editorial.resume(id);
  }
  @Post("photos/:id") photo(
    @Param("id") id: string,
    @Body() input: PhotoPoolDto,
  ) {
    return this.editorial.photo(
      id,
      input.enabled,
      input.tags,
      input.confirmation,
    );
  }
}
