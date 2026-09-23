import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Guild wars: resettable inter-guild competition (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueTag(prefix: string) {
    return `${prefix}${Math.random().toString(36).slice(2, 4)}`.toUpperCase().slice(0, 5);
  }

  async function createGuild(leaderToken: string, name: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leaderToken}`)
      .send({ name: `${name} ${Date.now()}-${randomUUID().slice(0, 4)}`, tag: uniqueTag(name.slice(0, 2)) })
      .expect(201);
    return res.body.id as string;
  }

  async function createLoginMission(rewardXp: number) {
    const code = `guild-war-test-${randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/missions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Se connecter", description: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp })
      .expect(201);
    return res.body.id as string;
  }

  async function earnAndClaimXp(email: string, token: string, rewardXp: number) {
    const missionId = await createLoginMission(rewardXp);
    // The mission didn't exist yet at registration time, so its LOGIN
    // progress needs a fresh login to record.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "Abcdef1234" }).expect(201);
    const missions = await request(app.getHttpServer()).get("/api/v1/missions").set("Authorization", `Bearer ${token}`).expect(200);
    const target = missions.body.find((m: { mission: { id: string } }) => m.mission.id === missionId);
    await request(app.getHttpServer()).post(`/api/v1/missions/${target.userMissionId}/claim`).set("Authorization", `Bearer ${token}`).expect(201);
  }

  async function balanceOf(token: string) {
    const res = await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${token}`).expect(200);
    return res.body.balance as number;
  }

  it("tallies XP per guild, ranks them, and pays top-3 rewards to members when the period ends", async () => {
    // Leave no period active behind from a previous run in this shared test DB.
    await request(app.getHttpServer()).post("/api/v1/admin/guild-wars/end-active").set("Authorization", `Bearer ${adminToken}`);
    const noneActive = await request(app.getHttpServer()).get("/api/v1/guild-wars/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(noneActive.body).toBeNull();

    const period1 = await request(app.getHttpServer())
      .post("/api/v1/admin/guild-wars")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Guerre de test ${Date.now()}` })
      .expect(201);
    expect(period1.body.status).toBe("ACTIVE");

    const leaderA = await registerUser(app, adminToken, "warleaderA");
    const memberA = await registerUser(app, adminToken, "warmemberA");
    const guildAId = await createGuild(leaderA.accessToken, "GuildA");
    await request(app.getHttpServer()).post(`/api/v1/guilds/${guildAId}/join`).set("Authorization", `Bearer ${memberA.accessToken}`).expect(201);

    const leaderB = await registerUser(app, adminToken, "warleaderB");
    await createGuild(leaderB.accessToken, "GuildB");

    // Guild A earns more XP than Guild B, split across two members.
    await earnAndClaimXp(leaderA.email, leaderA.accessToken, 30);
    await earnAndClaimXp(memberA.email, memberA.accessToken, 20);
    await earnAndClaimXp(leaderB.email, leaderB.accessToken, 15);

    const board = await request(app.getHttpServer()).get("/api/v1/guild-wars/leaderboard").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(board.body.period.id).toBe(period1.body.id);
    const entryA = board.body.entries.find((e: { guildId: string }) => e.guildId === guildAId);
    expect(entryA.points).toBe(50);
    expect(entryA.rank).toBe(1);
    expect(entryA.memberCount).toBe(2);

    const balanceBeforeA = await balanceOf(leaderA.accessToken);
    const balanceBeforeMemberA = await balanceOf(memberA.accessToken);
    const balanceBeforeB = await balanceOf(leaderB.accessToken);

    // Ending the period pays every member of the winning guild the rank-1 CR reward.
    const ended = await request(app.getHttpServer()).post("/api/v1/admin/guild-wars/end-active").set("Authorization", `Bearer ${adminToken}`).expect(201);
    expect(ended.body.status).toBe("ENDED");

    expect(await balanceOf(leaderA.accessToken)).toBe(balanceBeforeA + GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_1);
    expect(await balanceOf(memberA.accessToken)).toBe(balanceBeforeMemberA + GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_1);
    expect(await balanceOf(leaderB.accessToken)).toBe(balanceBeforeB + GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_2);

    const noneAfterEnd = await request(app.getHttpServer()).get("/api/v1/guild-wars/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(noneAfterEnd.body).toBeNull();

    // Starting a new period resets everyone's guild tally to zero, without touching permanent XP.
    const period2 = await request(app.getHttpServer())
      .post("/api/v1/admin/guild-wars")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Guerre suivante ${Date.now()}` })
      .expect(201);
    expect(period2.body.id).not.toBe(period1.body.id);

    const board2 = await request(app.getHttpServer()).get("/api/v1/guild-wars/leaderboard").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(board2.body.entries.find((e: { guildId: string }) => e.guildId === guildAId)).toBeFalsy();
  });

  it("rejects a non-admin trying to start or end a guild war period", async () => {
    const player = await registerUser(app, adminToken, "warplayer2");
    await request(app.getHttpServer())
      .post("/api/v1/admin/guild-wars")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ name: "Nope" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/admin/guild-wars/end-active")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(403);
  });
});
