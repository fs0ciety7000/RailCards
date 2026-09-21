import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ReportsService } from "../admin/reports.service";
import { FileReportDto } from "./dto/file-report.dto";

@ApiTags("social")
@ApiBearerAuth()
@Controller({ path: "reports", version: "1" })
export class SocialController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  async fileReport(@CurrentUser() user: AuthenticatedUser, @Body() dto: FileReportDto) {
    if (dto.targetUserId === user.id) throw new BadRequestException("You cannot report yourself");
    return this.reports.fileReport(user.id, dto.targetUserId, dto.reason, dto.details);
  }
}
