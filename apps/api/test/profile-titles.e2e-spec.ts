import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Profile titles: cosmetic unlocks via achievements (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTitle(slug: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/profile-titles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, label: `Titre ${slug}` })
      .expect(201);
    return res.body as { id: string; slug: string; label: string };
  }

  it("denies a non-admin from creating a profile title", async () => {
    const player = await registerUser(app, adminToken, "titleplayer1");
    await request(app.getHttpServer())
      .post("/api/v1/admin/profile-titles")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ slug: `nope-${randomUUID().slice(0, 6)}`, label: "Nope" })
      .expect(403);
  });

  it("rejects creating two titles with the same slug", async () => {
    const slug = `dup-${randomUUID().slice(0, 8)}`;
    await createTitle(slug);
    await request(app.getHttpServer())
      .post("/api/v1/admin/profile-titles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, label: "Doublon" })
      .expect(409);
  });

  it("lists the catalog for any authenticated player", async () => {
    const title = await createTitle(`catalog-${randomUUID().slice(0, 8)}`);
    const player = await registerUser(app, adminToken, "titleplayer2");
    const catalog = await request(app.getHttpServer()).get("/api/v1/profile-titles").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(catalog.body.some((t: { id: string }) => t.id === title.id)).toBe(true);
  });

  it("unlocks a title on achievement claim, lets the player equip it, and reflects it on /me and the public profile", async () => {
    const title = await createTitle(`unlock-${randomUUID().slice(0, 8)}`);
    const otherTitle = await createTitle(`other-${randomUUID().slice(0, 8)}`);

    const code = `title-achievement-${randomUUID().slice(0, 8)}`;
    const achievement = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Titre débloqué",
        description: "…",
        goalType: "LOGIN",
        goalCount: 1,
        rewardCr: 10,
        rewardXp: 5,
        rewardTitleId: title.id,
      })
      .expect(201);

    const player = await registerUser(app, adminToken, "titleplayer3");

    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);

    const list = await request(app.getHttpServer()).get("/api/v1/achievements").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const target = list.body.find((a: { achievement: { id: string } }) => a.achievement.id === achievement.body.id);
    expect(target.completedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/achievements/${achievement.body.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);

    const mineAfterClaim = await request(app.getHttpServer()).get("/api/v1/profile-titles/mine").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(mineAfterClaim.body.unlocked.some((t: { id: string }) => t.id === title.id)).toBe(true);
    expect(mineAfterClaim.body.active).toBeNull();

    // Equipping a title that wasn't unlocked is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/profile-titles/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ titleId: otherTitle.id })
      .expect(403);

    const equipped = await request(app.getHttpServer())
      .post("/api/v1/profile-titles/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ titleId: title.id })
      .expect(201);
    expect(equipped.body.active.id).toBe(title.id);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(me.body.activeTitle.id).toBe(title.id);
    expect(me.body.unlockedTitles.some((t: { id: string }) => t.id === title.id)).toBe(true);

    const publicProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${player.user.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(publicProfile.body.activeTitle.id).toBe(title.id);

    const cleared = await request(app.getHttpServer())
      .post("/api/v1/profile-titles/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ titleId: null })
      .expect(201);
    expect(cleared.body.active).toBeNull();
  });
});
