import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Card sleeves: cosmetic unlocks via achievements (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSleeve(slug: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/card-sleeves")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, name: `Pochette ${slug}`, colorFrom: "#2E7DD1", colorTo: "#1B4F87", pattern: "diagonal" })
      .expect(201);
    return res.body as { id: string; slug: string; name: string };
  }

  it("denies a non-admin from creating a card sleeve", async () => {
    const player = await registerUser(app, adminToken, "sleeveplayer1");
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-sleeves")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ slug: `nope-${randomUUID().slice(0, 6)}`, name: "Nope", colorFrom: "#000", colorTo: "#fff", pattern: "dots" })
      .expect(403);
  });

  it("rejects creating two sleeves with the same slug", async () => {
    const slug = `dup-${randomUUID().slice(0, 8)}`;
    await createSleeve(slug);
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-sleeves")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug, name: "Doublon", colorFrom: "#000", colorTo: "#fff", pattern: "dots" })
      .expect(409);
  });

  it("lists the catalog for any authenticated player", async () => {
    const sleeve = await createSleeve(`catalog-${randomUUID().slice(0, 8)}`);
    const player = await registerUser(app, adminToken, "sleeveplayer2");
    const catalog = await request(app.getHttpServer())
      .get("/api/v1/card-sleeves")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    expect(catalog.body.some((s: { id: string }) => s.id === sleeve.id)).toBe(true);
  });

  it("unlocks a sleeve on achievement claim, lets the player equip it, and reflects it on /me and the public profile", async () => {
    const sleeve = await createSleeve(`unlock-${randomUUID().slice(0, 8)}`);
    const otherSleeve = await createSleeve(`other-${randomUUID().slice(0, 8)}`);

    const code = `sleeve-achievement-${randomUUID().slice(0, 8)}`;
    const achievement = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Pochette débloquée",
        description: "…",
        goalType: "LOGIN",
        goalCount: 1,
        rewardCr: 10,
        rewardXp: 5,
        rewardSleeveId: sleeve.id,
      })
      .expect(201);

    const player = await registerUser(app, adminToken, "sleeveplayer3");

    // The achievement didn't exist yet at registration time, so its LOGIN
    // progress needs a fresh login to record.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);

    const list = await request(app.getHttpServer()).get("/api/v1/achievements").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const target = list.body.find((a: { achievement: { id: string } }) => a.achievement.id === achievement.body.id);
    expect(target.completedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/achievements/${achievement.body.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);

    const mineAfterClaim = await request(app.getHttpServer())
      .get("/api/v1/card-sleeves/mine")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    expect(mineAfterClaim.body.unlocked.some((s: { id: string }) => s.id === sleeve.id)).toBe(true);
    expect(mineAfterClaim.body.active).toBeNull();

    // Equipping a sleeve that wasn't unlocked is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/card-sleeves/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ sleeveId: otherSleeve.id })
      .expect(403);

    const equipped = await request(app.getHttpServer())
      .post("/api/v1/card-sleeves/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ sleeveId: sleeve.id })
      .expect(201);
    expect(equipped.body.active.id).toBe(sleeve.id);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(me.body.activeSleeve.id).toBe(sleeve.id);
    expect(me.body.unlockedSleeves.some((s: { id: string }) => s.id === sleeve.id)).toBe(true);

    const publicProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${player.user.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(publicProfile.body.activeSleeve.id).toBe(sleeve.id);

    // Clearing the active sleeve is allowed (null is always a valid target).
    const cleared = await request(app.getHttpServer())
      .post("/api/v1/card-sleeves/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ sleeveId: null })
      .expect(201);
    expect(cleared.body.active).toBeNull();
  });
});
