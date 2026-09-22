import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Leaderboard (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("ranks players by XP, includes card counts, and reflects XP gains", async () => {
    const { accessToken, username } = await registerUser(app, adminToken, "lbuser");

    const before = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const entryBefore = before.body.find((e: { username: string }) => e.username === username);
    expect(entryBefore).toBeTruthy();
    expect(entryBefore.xp).toBe(0);
    expect(entryBefore.uniqueCardCount).toBe(0);

    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);

    const missions = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const openBoosterMission = missions.body.find((m: { mission: { code: string } }) => m.mission.code === "daily-open-booster");
    await request(app.getHttpServer())
      .post(`/api/v1/missions/${openBoosterMission.userMissionId}/claim`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const entryAfter = after.body.find((e: { username: string }) => e.username === username);
    expect(entryAfter.xp).toBeGreaterThan(0);
    expect(entryAfter.uniqueCardCount).toBeGreaterThan(0);

    // Sorted descending by XP.
    const xps = after.body.map((e: { xp: number }) => e.xp);
    expect([...xps].sort((a: number, b: number) => b - a)).toEqual(xps);
  });

  it("excludes players who've hidden their profile", async () => {
    const { accessToken, username } = await registerUser(app, adminToken, "lbprivate");

    let list = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.some((e: { username: string }) => e.username === username)).toBe(true);

    await request(app.getHttpServer())
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isPublic: false })
      .expect(200);

    list = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.some((e: { username: string }) => e.username === username)).toBe(false);
  });
});
