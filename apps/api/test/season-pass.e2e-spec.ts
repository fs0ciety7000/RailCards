import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Season pass: milestone rewards over season points (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function startFreshSeason() {
    await request(app.getHttpServer()).post("/api/v1/admin/seasons/end-active").set("Authorization", `Bearer ${adminToken}`);
    const season = await request(app.getHttpServer())
      .post("/api/v1/admin/seasons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Saison pass ${Date.now()}` })
      .expect(201);
    return season.body.id as string;
  }

  async function createTier(tier: number, pointsRequired: number, rewardCr: number, rewardXp: number) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/season-pass/tiers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tier, pointsRequired, rewardCr, rewardXp, rewardLabel: `Titre du palier ${tier}` })
      .expect(201);
    return res.body.id as string;
  }

  async function createLoginMission(rewardXp: number) {
    const code = `pass-test-${randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Se connecter", description: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp })
      .expect(201);
    return res.body.id as string;
  }

  async function earnSeasonPoints(email: string, token: string, points: number) {
    const missionId = await createLoginMission(points);
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "Abcdef1234" }).expect(201);
    const missions = await request(app.getHttpServer()).get("/api/v1/missions").set("Authorization", `Bearer ${token}`).expect(200);
    const target = missions.body.find((m: { mission: { id: string } }) => m.mission.id === missionId);
    await request(app.getHttpServer()).post(`/api/v1/missions/${target.userMissionId}/claim`).set("Authorization", `Bearer ${token}`).expect(201);
  }

  async function walletBalance(token: string) {
    const res = await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${token}`).expect(200);
    return res.body.balance as number;
  }

  it("unlocks a tier once enough season points are earned, and pays its reward exactly once on claim", async () => {
    await startFreshSeason();
    await createTier(1, 10, 50, 20);
    await createTier(2, 100, 200, 50);

    const player = await registerUser(app, adminToken, "passplayer1");

    const before = await request(app.getHttpServer()).get("/api/v1/season-pass/tiers").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(before.body.tiers).toHaveLength(2);
    expect(before.body.tiers[0].unlocked).toBe(false);
    expect(before.body.tiers[0].claimed).toBe(false);

    await earnSeasonPoints(player.email, player.accessToken, 15);

    const afterEarning = await request(app.getHttpServer()).get("/api/v1/season-pass/tiers").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(afterEarning.body.points).toBe(15);
    const tier1 = afterEarning.body.tiers.find((t: { tier: number }) => t.tier === 1);
    const tier2 = afterEarning.body.tiers.find((t: { tier: number }) => t.tier === 2);
    expect(tier1.unlocked).toBe(true);
    expect(tier2.unlocked).toBe(false);

    const balanceBefore = await walletBalance(player.accessToken);
    const claimed = await request(app.getHttpServer())
      .post(`/api/v1/season-pass/tiers/${tier1.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);
    expect(claimed.body.tierId).toBe(tier1.id);
    expect(await walletBalance(player.accessToken)).toBe(balanceBefore + 50);

    // Reward XP is a flat grant, not itself counted toward the season tally.
    const afterClaim = await request(app.getHttpServer()).get("/api/v1/season-pass/tiers").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(afterClaim.body.points).toBe(15);
    expect(afterClaim.body.tiers.find((t: { tier: number }) => t.tier === 1).claimed).toBe(true);

    // Double-claiming the same tier is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/season-pass/tiers/${tier1.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(400);

    // Tier 2 still isn't claimable — the threshold hasn't been reached.
    await request(app.getHttpServer())
      .post(`/api/v1/season-pass/tiers/${tier2.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(400);
  });

  it("resets to a fresh, empty tier list when a new season starts", async () => {
    await startFreshSeason();
    const player = await registerUser(app, adminToken, "passplayer2");
    const empty = await request(app.getHttpServer()).get("/api/v1/season-pass/tiers").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(empty.body.tiers).toEqual([]);
    expect(empty.body.points).toBe(0);
  });

  it("rejects a non-admin creating or updating a season pass tier", async () => {
    await startFreshSeason();
    const player = await registerUser(app, adminToken, "passplayer3");
    await request(app.getHttpServer())
      .post("/api/v1/admin/season-pass/tiers")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ tier: 1, pointsRequired: 10 })
      .expect(403);
  });
});
