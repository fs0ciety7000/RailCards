import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Missions, achievements & leveling (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "missionuser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("completes a daily mission by opening a booster, grants XP on claim, and reports no level-up for a small reward", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(before.body.xp).toBe(0);
    expect(before.body.level).toBe(1);
    expect(before.body.grade).toBe("Apprenti aiguilleur");

    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);

    const missions = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    const openBoosterMission = missions.body.find((m: { mission: { code: string } }) => m.mission.code === "daily-open-booster");
    expect(openBoosterMission).toBeTruthy();
    expect(openBoosterMission.completedAt).toBeTruthy();
    expect(openBoosterMission.claimedAt).toBeFalsy();

    const claim = await request(app.getHttpServer())
      .post(`/api/v1/missions/${openBoosterMission.userMissionId}/claim`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(201);
    expect(claim.body.claimedAt).toBeTruthy();
    expect(claim.body.leveledUp).toBe(false);

    // Claiming a second time must be rejected and must not grant XP again.
    await request(app.getHttpServer())
      .post(`/api/v1/missions/${openBoosterMission.userMissionId}/claim`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(400);

    const after = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(after.body.xp).toBe(10); // daily-open-booster rewardXp
    expect(after.body.level).toBe(1);
  });

  it("completes and lets you claim the daily login mission just by registering/logging in", async () => {
    const registered = await registerUser(app, adminToken, "loginmissionuser");

    const missions = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(200);
    const loginMission = missions.body.find((m: { mission: { code: string } }) => m.mission.code === "daily-login");
    expect(loginMission).toBeTruthy();
    expect(loginMission.completedAt).toBeTruthy();
    expect(loginMission.claimedAt).toBeFalsy();

    const claim = await request(app.getHttpServer())
      .post(`/api/v1/missions/${loginMission.userMissionId}/claim`)
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(201);
    expect(claim.body.claimedAt).toBeTruthy();

    // Logging in again the same day must not re-trigger progress past the goal
    // (goalCount 1) or blow up on the already-claimed mission.
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: registered.email, password: "Abcdef1234" })
      .expect(201);
  });

  it("rejects claiming a mission that isn't completed yet", async () => {
    const registered = await registerUser(app, adminToken, "missionuser2");
    const missions = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(200);
    const notCompleted = missions.body.find((m: { completedAt: string | null }) => !m.completedAt);
    expect(notCompleted).toBeTruthy();

    if (notCompleted.userMissionId) {
      await request(app.getHttpServer())
        .post(`/api/v1/missions/${notCompleted.userMissionId}/claim`)
        .set("Authorization", `Bearer ${registered.accessToken}`)
        .expect(400);
    }
  });
});
