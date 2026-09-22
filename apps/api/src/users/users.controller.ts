import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { StorageService } from "../storage/storage.service";
import { UsersService } from "./users.service";
import { FavoritesService } from "./favorites.service";
import { UpdateMeDto } from "./dto/update-me.dto";

class AddFavoriteDto {
  @IsUUID("4")
  cardDefinitionId!: string;
}

// Note: RailCards is invite-gated end to end, so even "public" player
// profiles require an authenticated session — there is no anonymous
// browsing surface. @Public() is intentionally not used here.
@ApiTags("users")
@ApiBearerAuth()
@Controller({ version: "1" })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
    private readonly favorites: FavoritesService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch("me")
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post("me/avatar")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    const { url } = await this.storage.saveImage(file);
    return this.usersService.updateMe(user.id, { avatarUrl: url });
  }

  @Post("me/favorites")
  async addFavorite(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddFavoriteDto) {
    return this.favorites.add(user.id, dto.cardDefinitionId);
  }

  @Delete("me/favorites/:cardDefinitionId")
  async removeFavorite(@CurrentUser() user: AuthenticatedUser, @Param("cardDefinitionId") cardDefinitionId: string) {
    return this.favorites.remove(user.id, cardDefinitionId);
  }

  @Get("users/:username")
  async publicProfile(@CurrentUser() user: AuthenticatedUser, @Param("username") username: string) {
    return this.usersService.getPublicProfile(username, user);
  }

  @Get("users/:username/collection")
  async publicCollection(
    @Param("username") username: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "24",
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 24));
    return this.usersService.getPublicCollection(username, p, ps);
  }
}
