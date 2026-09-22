import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin: missions & achievements CRUD (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "adminmissionuser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies a regular user access to mission/achievement admin endpoints", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/missions").set("Authorization", `Bearer ${userToken}`).expect(403);
    await request(app.getHttpServer()).get("/api/v1/admin/achievements").set("Authorization", `Bearer ${userToken}`).expect(403);
  });

  it("lets an admin create and edit a mission, which then shows up for players", async () => {
    const code = `test-mission-${randomUUID().slice(0, 8)}`;
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Mission de test",
        description: "Une mission créée par un test e2e.",
        goalType: "SELL_ON_MARKET",
        goalCount: 3,
        rewardCr: 42,
        rewardXp: 7,
        resetPeriod: "DAILY",
      })
      .expect(201);
    expect(create.body.code).toBe(code);
    expect(create.body.isActive).toBe(true);

    const update = await request(app.getHttpServer())
      .patch(`/api/v1/admin/missions/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Mission de test (modifiée)", rewardCr: 99 })
      .expect(200);
    expect(update.body.title).toBe("Mission de test (modifiée)");
    expect(update.body.rewardCr).toBe(99);

    const list = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    const found = list.body.find((m: { mission: { code: string } }) => m.mission.code === code);
    expect(found).toBeTruthy();
    expect(found.mission.title).toBe("Mission de test (modifiée)");
  });

  it("lets an admin deactivate a mission so it stops appearing for players", async () => {
    const code = `test-mission-deact-${randomUUID().slice(0, 8)}`;
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "À désactiver", description: "…", goalType: "BUY_ON_MARKET", goalCount: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/missions/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(list.body.some((m: { mission: { code: string } }) => m.mission.code === code)).toBe(false);
  });

  it("lets an admin create and edit an achievement, which then shows up for players", async () => {
    const code = `test-achievement-${randomUUID().slice(0, 8)}`;
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Haut fait de test",
        description: "Un haut fait créé par un test e2e.",
        goalType: "COMPLETE_TRADE",
        goalCount: 5,
        rewardCr: 200,
        rewardXp: 100,
      })
      .expect(201);
    expect(create.body.code).toBe(code);

    const update = await request(app.getHttpServer())
      .patch(`/api/v1/admin/achievements/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ goalCount: 10 })
      .expect(200);
    expect(update.body.goalCount).toBe(10);

    const list = await request(app.getHttpServer())
      .get("/api/v1/achievements")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    const found = list.body.find((a: { achievement: { code: string } }) => a.achievement.code === code);
    expect(found).toBeTruthy();
    expect(found.achievement.goalCount).toBe(10);
  });

  it("rejects an invalid goalType", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "bad-goal-type", title: "x", description: "x", goalType: "NOT_A_REAL_TYPE", goalCount: 1 })
      .expect(400);
  });
});
