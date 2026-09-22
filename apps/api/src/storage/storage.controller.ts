import { createReadStream, existsSync } from "node:fs";
import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { StorageService } from "./storage.service";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

@ApiTags("storage")
@Controller({ path: "uploads", version: "1" })
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(":filename")
  serve(@Param("filename") filename: string, @Res({ passthrough: true }) res: Response): StreamableFile {
    const filePath = this.storage.resolveFilePath(filename);
    if (!existsSync(filePath)) throw new NotFoundException("File not found");

    const ext = filename.split(".").pop() ?? "";
    // Filenames are content-addressed (random UUID, never reused), so the
    // response can be cached by the browser/CDN forever.
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    return new StreamableFile(createReadStream(filePath), {
      type: CONTENT_TYPES[ext] ?? "application/octet-stream",
      disposition: `inline; filename="${filename}"`,
    });
  }
}
