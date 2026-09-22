import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Local-disk image storage. S3-compatible storage (see S3_* in
 * .env.example) is documented but not wired up yet — swapping this
 * service's internals for an S3 client is the only change that would
 * take, callers only ever see saveImage()/resolveFilePath().
 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  private get uploadDir(): string {
    const dir = this.config.get<string>("LOCAL_STORAGE_DIR") ?? "storage/uploads";
    return path.resolve(process.cwd(), dir);
  }

  private get maxSizeBytes(): number {
    const mb = this.config.get<number>("UPLOAD_MAX_SIZE_MB") ?? 5;
    return mb * 1024 * 1024;
  }

  async saveImage(file: Express.Multer.File): Promise<{ url: string; filename: string }> {
    const ext = ALLOWED_MIME_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
      );
    }
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(`File too large (max ${Math.floor(this.maxSizeBytes / 1024 / 1024)} MB)`);
    }

    const filename = `${randomUUID()}.${ext}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, filename), file.buffer);

    const apiBaseUrl = (this.config.get<string>("API_BASE_URL") ?? "http://localhost:4000").replace(/\/+$/, "");
    return { url: `${apiBaseUrl}/api/v1/uploads/${filename}`, filename };
  }

  /** Resolves a filename to an on-disk path, rejecting anything but a bare filename. */
  resolveFilePath(filename: string): string {
    if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      throw new BadRequestException("Invalid filename");
    }
    return path.join(this.uploadDir, filename);
  }
}
