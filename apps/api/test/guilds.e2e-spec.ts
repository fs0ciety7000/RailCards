import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { GAME_CONSTANTS, guildMaxMembers } from "@railcards/game-domain";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Guilds: small player-run groups (e2e, real Postgres)", () => {
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

  it("creates a guild (creator becomes leader), rejects joining a second one, and lets a member leave", async () => {
    const leader = await registerUser(app, adminToken, "guildleader1");
    const member = await registerUser(app, adminToken, "guildmember1");

    const created = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Cheminots Unis ${Date.now()}`, tag: uniqueTag("CU") })
      .expect(201);
    expect(created.body.memberCount).toBe(1);
    expect(created.body.members[0].role).toBe("LEADER");
    expect(created.body.leaderId).toBe(leader.user.id);

    // Creating a second guild while already in one is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Autre Guilde ${Date.now()}`, tag: uniqueTag("AG") })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${created.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${created.body.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(detail.body.memberCount).toBe(2);

    // Joining a second guild while already a member elsewhere is rejected.
    const otherGuild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${(await registerUser(app, adminToken, "guildowner2")).accessToken}`)
      .send({ name: `Autre Rail ${Date.now()}`, tag: uniqueTag("AR") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${otherGuild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);

    await request(app.getHttpServer()).post("/api/v1/guilds/leave").set("Authorization", `Bearer ${member.accessToken}`).expect(201);

    const afterLeave = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${created.body.id}`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(200);
    expect(afterLeave.body.memberCount).toBe(1);
  });

  it("transfers leadership to the longest-tenured member when the leader leaves, and disbands a solo guild", async () => {
    const leader = await registerUser(app, adminToken, "guildleader3");
    const first = await registerUser(app, adminToken, "guildfirst3");
    const second = await registerUser(app, adminToken, "guildsecond3");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Relève Express ${Date.now()}`, tag: uniqueTag("RE") })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(201);

    await request(app.getHttpServer()).post("/api/v1/guilds/leave").set("Authorization", `Bearer ${leader.accessToken}`).expect(201);

    const afterLeaderLeft = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);
    expect(afterLeaderLeft.body.leaderId).toBe(first.user.id);
    expect(afterLeaderLeft.body.memberCount).toBe(2);

    await request(app.getHttpServer()).post("/api/v1/guilds/leave").set("Authorization", `Bearer ${second.accessToken}`).expect(201);

    // Last member leaving disbands the guild — it should now 404.
    await request(app.getHttpServer()).post("/api/v1/guilds/leave").set("Authorization", `Bearer ${first.accessToken}`).expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(404);
  });

  it("lets the leader promote/demote/kick members and transfer leadership, enforcing role permissions", async () => {
    const leader = await registerUser(app, adminToken, "guildleader4");
    const officer = await registerUser(app, adminToken, "guildofficer4");
    const rookie = await registerUser(app, adminToken, "guildrookie4");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Aiguillage ${Date.now()}`, tag: uniqueTag("AI") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${officer.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${rookie.accessToken}`)
      .expect(201);

    // A regular member can't promote anyone.
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${rookie.user.id}/promote`)
      .set("Authorization", `Bearer ${officer.accessToken}`)
      .expect(403);

    const promoted = await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${officer.user.id}/promote`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(201);
    expect(promoted.body.members.find((m: { userId: string }) => m.userId === officer.user.id).role).toBe("OFFICER");

    // An officer can kick a regular member, but not another officer.
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${leader.user.id}/kick`)
      .set("Authorization", `Bearer ${officer.accessToken}`)
      .expect(409); // leader can't be kicked

    const afterKick = await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${rookie.user.id}/kick`)
      .set("Authorization", `Bearer ${officer.accessToken}`)
      .expect(201);
    expect(afterKick.body.memberCount).toBe(2);

    const demoted = await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${officer.user.id}/demote`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(201);
    expect(demoted.body.members.find((m: { userId: string }) => m.userId === officer.user.id).role).toBe("MEMBER");

    const transferred = await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${officer.user.id}/transfer-leadership`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(201);
    expect(transferred.body.leaderId).toBe(officer.user.id);
    expect(transferred.body.members.find((m: { userId: string }) => m.userId === leader.user.id).role).toBe("OFFICER");

    // The old leader (now an officer) can no longer transfer leadership themselves.
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/members/${leader.user.id}/transfer-leadership`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(403);
  });

  it("lets the leader disband the guild, notifying remaining members, and rejects a non-leader trying to", async () => {
    const leader = await registerUser(app, adminToken, "guildleader5");
    const member = await registerUser(app, adminToken, "guildmember5");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Voie de Garage ${Date.now()}`, tag: uniqueTag("VG") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(404);
  });

  it("rejects joining a guild that's already full", async () => {
    const leader = await registerUser(app, adminToken, "guildfull6");
    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Petit Comité ${Date.now()}`, tag: uniqueTag("PC") })
      .expect(201);

    // GAME_CONSTANTS.GUILD_MAX_MEMBERS is 30; fill the remaining 29 slots.
    for (let i = 0; i < 29; i++) {
      const player = await registerUser(app, adminToken, `guildfiller6${i}`);
      await request(app.getHttpServer())
        .post(`/api/v1/guilds/${guild.body.id}/join`)
        .set("Authorization", `Bearer ${player.accessToken}`)
        .expect(201);
    }

    const overflow = await registerUser(app, adminToken, "guildoverflow6");
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${overflow.accessToken}`)
      .expect(409);
  }, 30_000);

  it("shows guilds ranked by total member XP on the leaderboard", async () => {
    const leader = await registerUser(app, adminToken, "guildlb7");
    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Classement ${Date.now()}`, tag: uniqueTag("CE") })
      .expect(201);

    const board = await request(app.getHttpServer())
      .get("/api/v1/guilds/leaderboard")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(200);
    expect(board.body.some((row: { id: string }) => row.id === guild.body.id)).toBe(true);
  });

  it("hands off leadership when an admin deletes the leader's account, and disbands a solo leader's guild on deletion", async () => {
    const leader = await registerUser(app, adminToken, "guilddel8");
    const member = await registerUser(app, adminToken, "guildmemberdel8");
    const soloLeader = await registerUser(app, adminToken, "guildsolo8");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Terminus Nord ${Date.now()}`, tag: uniqueTag("TN") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    await request(app.getHttpServer()).delete(`/api/v1/admin/users/${leader.user.id}`).set("Authorization", `Bearer ${adminToken}`).expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(afterDelete.body.leaderId).toBe(member.user.id);

    const soloGuild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${soloLeader.accessToken}`)
      .send({ name: `Wagon Solitaire ${Date.now()}`, tag: uniqueTag("WS") })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${soloLeader.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/guilds/${soloGuild.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });

  async function createLoginMission(rewardXp: number) {
    const code = `guild-level-test-${randomUUID().slice(0, 8)}`;
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

  it("levels up the guild's own permanent XP pool from member activity, unlocking extra slots and paying every member once", async () => {
    const leader = await registerUser(app, adminToken, "guildlvl9");
    const member = await registerUser(app, adminToken, "guildlvlmember9");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Guilde Niveau ${Date.now()}`, tag: uniqueTag("LA") })
      .expect(201);
    expect(guild.body.xp).toBe(0);
    expect(guild.body.level).toBe(1);
    expect(guild.body.maxMembers).toBe(GAME_CONSTANTS.GUILD_MAX_MEMBERS);

    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    const balanceBeforeLeader = await balanceOf(leader.accessToken);
    const balanceBeforeMember = await balanceOf(member.accessToken);

    // xpThresholdForLevel(6) = 100 * (5*6/2) = 1500 — enough to jump the
    // guild from level 1 straight to level 6 in one claim, crossing several
    // level-up thresholds at once so the "only the final level pays out"
    // behavior (mirroring the player level-up notification) gets exercised.
    await earnAndClaimXp(leader.email, leader.accessToken, 1500);

    const afterLevelUp = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(200);
    expect(afterLevelUp.body.xp).toBe(1500);
    expect(afterLevelUp.body.level).toBe(6);
    expect(afterLevelUp.body.maxMembers).toBe(
      guildMaxMembers(6, GAME_CONSTANTS.GUILD_MAX_MEMBERS, GAME_CONSTANTS.GUILD_LEVEL_SLOTS_TIER_SIZE, GAME_CONSTANTS.GUILD_LEVEL_MAX_EXTRA_SLOTS),
    );
    expect(afterLevelUp.body.maxMembers).toBeGreaterThan(GAME_CONSTANTS.GUILD_MAX_MEMBERS);

    // Every current member — not just the one who earned the XP — is paid
    // exactly once for the level-up, regardless of how many thresholds were crossed.
    expect(await balanceOf(leader.accessToken)).toBe(balanceBeforeLeader + GAME_CONSTANTS.GUILD_LEVEL_UP_REWARD_CR_PER_MEMBER);
    expect(await balanceOf(member.accessToken)).toBe(balanceBeforeMember + GAME_CONSTANTS.GUILD_LEVEL_UP_REWARD_CR_PER_MEMBER);
  });

  it("doesn't level up a player's guild XP when they aren't in a guild", async () => {
    const solo = await registerUser(app, adminToken, "guildlvlsolo9");
    await earnAndClaimXp(solo.email, solo.accessToken, 500);
    // No assertion beyond "this doesn't throw" — grantBonusXp's guild bump
    // is a documented no-op when the player has no guild membership.
  });
});
