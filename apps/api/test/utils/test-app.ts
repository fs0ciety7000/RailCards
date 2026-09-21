import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "../../src/app.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.railcards.local`;
}

export function uniqueUsername(prefix: string): string {
  // Usernames are capped at 20 chars server-side, so keep the prefix short
  // and the unique suffix compact (base36 timestamp tail + 2-digit rand).
  const shortPrefix = prefix.slice(0, 8).toLowerCase();
  const suffix = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10);
  return `${shortPrefix}${suffix}`.slice(0, 20);
}
