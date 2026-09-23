import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Live-ops events: XP multiplier banner (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createLoginMission(rewardXp: number) {
    const code = `event-test-${randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Se connecter", description: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp })
      .expect(201);
    return res.body.id as string;
  }

  it("has no active event by default, and doubles XP grants while a double-XP event is live", async () => {
    const player = await registerUser(app, adminToken, "eventplayer1");

    const initialActive = await request(app.getHttpServer()).get("/api/v1/events/active").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(initialActive.body).toBeNull();

    // Baseline claim, no event active: XP granted should equal the mission's raw rewardXp.
    await createLoginMission(40);
    const login1 = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);
    const token1 = login1.body.accessToken as string;
    const missions1 = await request(app.getHttpServer()).get("/api/v1/missions").set("Authorization", `Bearer ${token1}`).expect(200);
    const baseline = missions1.body.find((m: { mission: { rewardXp: number } }) => m.mission.rewardXp === 40 && m.completedAt);
    expect(baseline).toBeTruthy();

    const meBefore = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token1}`).expect(200);
    const claim1 = await request(app.getHttpServer())
      .post(`/api/v1/missions/${baseline.userMissionId}/claim`)
      .set("Authorization", `Bearer ${token1}`)
      .expect(201);
    const meAfterBaseline = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token1}`).expect(200);
    expect(meAfterBaseline.body.xp).toBe(meBefore.body.xp + 40);
    expect(claim1.body.claimedAt).toBeTruthy();

    // Now start a "double XP" event covering right now.
    const event = await request(app.getHttpServer())
      .post("/api/v1/admin/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `double-xp-${Date.now()}`,
        title: "Week-end Double XP",
        description: "Toutes les récompenses en XP sont doublées !",
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        xpMultiplierBps: 20000,
      })
      .expect(201);
    expect(event.body.isActive).toBe(true);

    const activeAfterCreate = await request(app.getHttpServer()).get("/api/v1/events/active").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(activeAfterCreate.body.id).toBe(event.body.id);
    expect(activeAfterCreate.body.xpMultiplierBps).toBe(20000);

    await createLoginMission(30);
    const login2 = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" }).expect(201);
    const token2 = login2.body.accessToken as string;
    const missions2 = await request(app.getHttpServer()).get("/api/v1/missions").set("Authorization", `Bearer ${token2}`).expect(200);
    const doubled = missions2.body.find((m: { mission: { rewardXp: number } }) => m.mission.rewardXp === 30 && m.completedAt);
    expect(doubled).toBeTruthy();

    const meBeforeDoubled = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token2}`).expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/missions/${doubled.userMissionId}/claim`)
      .set("Authorization", `Bearer ${token2}`)
      .expect(201);
    const meAfterDoubled = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token2}`).expect(200);
    // 30 base XP * 2x multiplier = 60.
    expect(meAfterDoubled.body.xp).toBe(meBeforeDoubled.body.xp + 60);

    // Deactivating the event stops both the banner and the multiplier.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/events/${event.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
    const activeAfterDeactivate = await request(app.getHttpServer())
      .get("/api/v1/events/active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    expect(activeAfterDeactivate.body).toBeNull();
  });

  it("rejects a non-admin trying to author an event", async () => {
    const player = await registerUser(app, adminToken, "eventplayer2");
    await request(app.getHttpServer())
      .post("/api/v1/admin/events")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({
        slug: `nope-${Date.now()}`,
        title: "x",
        description: "x",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 1000).toISOString(),
      })
      .expect(403);
  });
});
