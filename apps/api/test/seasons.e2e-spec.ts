import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Seasons: resettable competitive leaderboard (e2e, real Postgres)", () => {
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
    const code = `season-test-${randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Se connecter", description: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp })
      .expect(201);
    return res.body.id as string;
  }

  async function earnAndClaimXp(email: string, rewardXp: number) {
    const missionId = await createLoginMission(rewardXp);
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "Abcdef1234" }).expect(201);
    const token = login.body.accessToken as string;
    const missions = await request(app.getHttpServer()).get("/api/v1/missions").set("Authorization", `Bearer ${token}`).expect(200);
    const target = missions.body.find((m: { mission: { id: string } }) => m.mission.id === missionId);
    await request(app.getHttpServer()).post(`/api/v1/missions/${target.userMissionId}/claim`).set("Authorization", `Bearer ${token}`).expect(201);
    return token;
  }

  it("tracks season points separately from permanent XP, and resetting starts everyone back at zero", async () => {
    // Leave no season active behind from a previous run in this shared test DB.
    await request(app.getHttpServer()).post("/api/v1/admin/seasons/end-active").set("Authorization", `Bearer ${adminToken}`);
    const noSeasonCheck = await request(app.getHttpServer()).get("/api/v1/seasons/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(noSeasonCheck.body).toBeNull();

    const season1 = await request(app.getHttpServer())
      .post("/api/v1/admin/seasons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Saison de test ${Date.now()}` })
      .expect(201);
    expect(season1.body.status).toBe("ACTIVE");

    const player = await registerUser(app, adminToken, "seasonplayer1");
    await earnAndClaimXp(player.email, 25);

    const board1 = await request(app.getHttpServer()).get("/api/v1/seasons/leaderboard").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(board1.body.season.id).toBe(season1.body.id);
    const entry1 = board1.body.entries.find((e: { username: string }) => e.username === player.username);
    expect(entry1.points).toBe(25);

    // Starting a new season ends the old one and everyone's tally in the new one starts at zero.
    const season2 = await request(app.getHttpServer())
      .post("/api/v1/admin/seasons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Saison suivante ${Date.now()}` })
      .expect(201);
    expect(season2.body.id).not.toBe(season1.body.id);

    const board2 = await request(app.getHttpServer()).get("/api/v1/seasons/leaderboard").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(board2.body.season.id).toBe(season2.body.id);
    const entry2 = board2.body.entries.find((e: { username: string }) => e.username === player.username);
    expect(entry2).toBeFalsy(); // no points yet in the new season

    await earnAndClaimXp(player.email, 10);
    const board3 = await request(app.getHttpServer()).get("/api/v1/seasons/leaderboard").set("Authorization", `Bearer ${adminToken}`).expect(200);
    const entry3 = board3.body.entries.find((e: { username: string }) => e.username === player.username);
    expect(entry3.points).toBe(10);

    // The player's permanent XP/level was never rolled back by the reset.
    const meFinal = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${(await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: player.email, password: "Abcdef1234" })).body.accessToken}`)
      .expect(200);
    expect(meFinal.body.xp).toBe(35);
  });

  it("rejects a non-admin trying to start a season", async () => {
    const player = await registerUser(app, adminToken, "seasonplayer2");
    await request(app.getHttpServer())
      .post("/api/v1/admin/seasons")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ name: "Nope" })
      .expect(403);
  });
});
