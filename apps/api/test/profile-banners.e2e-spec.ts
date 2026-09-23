import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Profile banners: cosmetic unlocks via achievements (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createBanner(slug: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/profile-banners")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, name: `Bannière ${slug}`, colorFrom: "#f59e0b", colorTo: "#ef4444", icon: "flame" })
      .expect(201);
    return res.body as { id: string; slug: string; name: string };
  }

  it("denies a non-admin from creating a profile banner", async () => {
    const player = await registerUser(app, adminToken, "bannerplayer1");
    await request(app.getHttpServer())
      .post("/api/v1/admin/profile-banners")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ slug: `nope-${randomUUID().slice(0, 6)}`, name: "Nope", colorFrom: "#000", colorTo: "#fff", icon: "x" })
      .expect(403);
  });

  it("rejects creating two banners with the same slug", async () => {
    const slug = `dup-${randomUUID().slice(0, 8)}`;
    await createBanner(slug);
    await request(app.getHttpServer())
      .post("/api/v1/admin/profile-banners")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, name: "Doublon", colorFrom: "#000", colorTo: "#fff", icon: "x" })
      .expect(409);
  });

  it("lists the catalog for any authenticated player", async () => {
    const banner = await createBanner(`catalog-${randomUUID().slice(0, 8)}`);
    const player = await registerUser(app, adminToken, "bannerplayer2");
    const catalog = await request(app.getHttpServer()).get("/api/v1/profile-banners").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(catalog.body.some((b: { id: string }) => b.id === banner.id)).toBe(true);
  });

  it("unlocks a banner on achievement claim, lets the player equip it, and reflects it on /me and the public profile", async () => {
    const banner = await createBanner(`unlock-${randomUUID().slice(0, 8)}`);
    const otherBanner = await createBanner(`other-${randomUUID().slice(0, 8)}`);

    const code = `banner-achievement-${randomUUID().slice(0, 8)}`;
    const achievement = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Décoration débloquée",
        description: "…",
        goalType: "LOGIN",
        goalCount: 1,
        rewardCr: 10,
        rewardXp: 5,
        rewardBannerId: banner.id,
      })
      .expect(201);

    const player = await registerUser(app, adminToken, "bannerplayer3");

    // The achievement didn't exist yet at registration time, so its LOGIN
    // progress needs a fresh login to record — same pattern as the mission
    // XP fixtures elsewhere in this suite.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);

    const list = await request(app.getHttpServer()).get("/api/v1/achievements").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const target = list.body.find((a: { achievement: { id: string } }) => a.achievement.id === achievement.body.id);
    expect(target.completedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/achievements/${achievement.body.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);

    const mineAfterClaim = await request(app.getHttpServer()).get("/api/v1/profile-banners/mine").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(mineAfterClaim.body.unlocked.some((b: { id: string }) => b.id === banner.id)).toBe(true);
    expect(mineAfterClaim.body.active).toBeNull();

    // Equipping a banner that wasn't unlocked is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/profile-banners/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ bannerId: otherBanner.id })
      .expect(403);

    const equipped = await request(app.getHttpServer())
      .post("/api/v1/profile-banners/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ bannerId: banner.id })
      .expect(201);
    expect(equipped.body.active.id).toBe(banner.id);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(me.body.activeBanner.id).toBe(banner.id);
    expect(me.body.unlockedBanners.some((b: { id: string }) => b.id === banner.id)).toBe(true);

    const publicProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${player.user.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(publicProfile.body.activeBanner.id).toBe(banner.id);

    // Clearing the active banner is allowed (null is always a valid target).
    const cleared = await request(app.getHttpServer())
      .post("/api/v1/profile-banners/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ bannerId: null })
      .expect(201);
    expect(cleared.body.active).toBeNull();
  });
});
