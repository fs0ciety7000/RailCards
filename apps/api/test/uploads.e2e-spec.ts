import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

// A minimal valid 2x2 red PNG, generated once and inlined as base64 so this
// test has no filesystem fixture to keep in sync.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8z8BQz0AEYBw1cRQAn9gDAWyx6bMAAAAASUVORK5CYII=";

describe("Uploads (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "uploaduser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies non-admins and unauthenticated requests", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/uploads")
      .set("Authorization", `Bearer ${userToken}`)
      .attach("file", Buffer.from(TINY_PNG_BASE64, "base64"), "test.png")
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/admin/uploads")
      .attach("file", Buffer.from(TINY_PNG_BASE64, "base64"), "test.png")
      .expect(401);
  });

  it("rejects a request with no file and a file with a disallowed mimetype", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/uploads")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/admin/uploads")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("not an image"), "notes.txt")
      .expect(400);
  });

  it("lets an admin upload an image and serves it back byte-for-byte, publicly and cacheably", async () => {
    const pngBuffer = Buffer.from(TINY_PNG_BASE64, "base64");

    const uploadRes = await request(app.getHttpServer())
      .post("/api/v1/admin/uploads")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", pngBuffer, "test.png")
      .expect(201);

    expect(uploadRes.body.url).toMatch(/^http:\/\/localhost:4000\/api\/v1\/uploads\/[\w-]+\.png$/);
    expect(uploadRes.body.filename).toMatch(/^[\w-]+\.png$/);

    // Served without any Authorization header — must be publicly reachable
    // (card/booster art needs to load for every visitor).
    const servedRes = await request(app.getHttpServer())
      .get(`/api/v1/uploads/${uploadRes.body.filename}`)
      .expect(200);

    expect(servedRes.headers["content-type"]).toBe("image/png");
    expect(servedRes.headers["cache-control"]).toContain("immutable");
    expect(Buffer.compare(servedRes.body, pngBuffer)).toBe(0);
  });

  it("returns 404 for an unknown filename and 400 for a path-traversal attempt", async () => {
    await request(app.getHttpServer()).get("/api/v1/uploads/does-not-exist.png").expect(404);
    await request(app.getHttpServer())
      .get("/api/v1/uploads/" + encodeURIComponent("../../package.json"))
      .expect(400);
  });
});
