import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

// A minimal valid 2x2 red PNG, generated once and inlined as base64 so this
// test has no filesystem fixture to keep in sync.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8z8BQz0AEYBw1cRQAn9gDAWyx6bMAAAAASUVORK5CYII=";

describe("Users: self-service profile (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("updates displayName, bio and avatarUrl via PATCH /me", async () => {
    const { accessToken } = await registerUser(app, adminToken, "profileuser");

    const res = await request(app.getHttpServer())
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "Nouveau Nom", bio: "Amateur de trains." })
      .expect(200);

    expect(res.body.displayName).toBe("Nouveau Nom");

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(me.body.displayName).toBe("Nouveau Nom");
  });

  it("lets a user upload their own avatar without admin rights", async () => {
    const { accessToken } = await registerUser(app, adminToken, "avataruser");
    const pngBuffer = Buffer.from(TINY_PNG_BASE64, "base64");

    const res = await request(app.getHttpServer())
      .post("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pngBuffer, "avatar.png")
      .expect(201);

    expect(res.body.avatarUrl).toMatch(/^http:\/\/localhost:4000\/api\/v1\/uploads\/[\w-]+\.png$/);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(me.body.avatarUrl).toBe(res.body.avatarUrl);
  });

  it("hides a private profile from other players but not from its owner or an admin", async () => {
    const owner = await registerUser(app, adminToken, "privateuser");
    const viewer = await registerUser(app, adminToken, "vieweruser");

    await request(app.getHttpServer())
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ isPublic: false })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${owner.username}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${owner.username}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${owner.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
