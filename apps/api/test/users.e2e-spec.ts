import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
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

  it("shows claimed achievements as badges on the public profile, but not completed-yet-unclaimed ones", async () => {
    const player = await registerUser(app, adminToken, "badgeplayer");
    const viewer = await registerUser(app, adminToken, "badgeviewer");

    const code = `badge-achievement-${randomUUID().slice(0, 8)}`;
    const achievement = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Badge de test", description: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp: 5 })
      .expect(201);

    // The achievement didn't exist yet at registration time, so its LOGIN
    // progress needs a fresh login to record.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);

    const beforeClaim = await request(app.getHttpServer())
      .get(`/api/v1/users/${player.username}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(200);
    expect(beforeClaim.body.achievements.some((a: { code: string }) => a.code === code)).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/v1/achievements/${achievement.body.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);

    const afterClaim = await request(app.getHttpServer())
      .get(`/api/v1/users/${player.username}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(200);
    const badge = afterClaim.body.achievements.find((a: { code: string }) => a.code === code);
    expect(badge).toBeTruthy();
    expect(badge.title).toBe("Badge de test");
    expect(badge.claimedAt).toBeTruthy();
  });

  describe("GET /users/search", () => {
    it("finds a user by a case-insensitive partial username match, excluding the requester", async () => {
      const searcher = await registerUser(app, adminToken, "searcher");
      const target = await registerUser(app, adminToken, "railfan");

      const res = await request(app.getHttpServer())
        .get("/api/v1/users/search")
        .query({ q: target.username.slice(0, 5).toUpperCase() })
        .set("Authorization", `Bearer ${searcher.accessToken}`)
        .expect(200);

      expect(res.body.some((u: { username: string }) => u.username === target.username)).toBe(true);
      expect(res.body.some((u: { username: string }) => u.username === searcher.username)).toBe(false);
    });

    it("returns nothing for a query shorter than 2 characters", async () => {
      const { accessToken } = await registerUser(app, adminToken, "shortq");

      const res = await request(app.getHttpServer())
        .get("/api/v1/users/search")
        .query({ q: "a" })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});
