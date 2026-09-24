import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

// A fresh registration auto-grants the founders card while the cutoff hasn't
// passed (see AuthService.grantFoundersCardIfEligible), so a brand-new
// player already owns exactly one unique card until that date.
const NEW_PLAYER_STARTING_CARDS = new Date() < new Date(GAME_CONSTANTS.FOUNDERS_CARD_CUTOFF_ISO) ? 1 : 0;

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
    expect(entryBefore.uniqueCardCount).toBe(NEW_PLAYER_STARTING_CARDS);

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

  it("supports sorting by unique card count and by complete series count", async () => {
    const { accessToken } = await registerUser(app, adminToken, "lbsort");

    const byCards = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500&sortBy=cards")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const cardCounts = byCards.body.map((e: { uniqueCardCount: number }) => e.uniqueCardCount);
    expect([...cardCounts].sort((a: number, b: number) => b - a)).toEqual(cardCounts);

    const byAlbums = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500&sortBy=albums")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const albumCounts = byAlbums.body.map((e: { completeSeriesCount: number }) => e.completeSeriesCount);
    expect([...albumCounts].sort((a: number, b: number) => b - a)).toEqual(albumCounts);

    // An unknown sortBy value falls back to the default (XP) ranking rather than erroring.
    const bogus = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500&sortBy=not-a-real-sort")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const xps = bogus.body.map((e: { xp: number }) => e.xp);
    expect([...xps].sort((a: number, b: number) => b - a)).toEqual(xps);
  });

  it("scopes the board to the viewer's accepted friends (plus themselves) when scope=friends, including a private-profile friend", async () => {
    const alice = await registerUser(app, adminToken, "lbfriendalice");
    const bob = await registerUser(app, adminToken, "lbfriendbob");
    const stranger = await registerUser(app, adminToken, "lbfriendstranger");

    // Bob hides his profile — he should still show up for Alice on the
    // friends-scoped board, mirroring the guild leaderboard's own
    // mutual-consent visibility rule, even though he's excluded from the
    // global board.
    await request(app.getHttpServer()).patch("/api/v1/me").set("Authorization", `Bearer ${bob.accessToken}`).send({ isPublic: false }).expect(200);

    const sent = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ username: bob.username })
      .expect(201);
    const incoming = await request(app.getHttpServer())
      .get("/api/v1/friends/requests?direction=incoming")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(200);
    const incomingEntry = incoming.body.find((r: { id: string }) => r.id === sent.body.id);
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${incomingEntry.id}/accept`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    const friendsBoard = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500&scope=friends")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    const usernames = friendsBoard.body.map((e: { username: string }) => e.username);
    expect(usernames).toContain(alice.username);
    expect(usernames).toContain(bob.username);
    expect(usernames).not.toContain(stranger.username);

    // The global board still hides Bob (private) — separately covered for
    // publicness in general above; here it's enough to confirm the friends
    // scope doesn't leak into the global one.
    const globalBoard = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(globalBoard.body.map((e: { username: string }) => e.username)).not.toContain(bob.username);

    // A player with no friends sees just themselves on the friends board.
    const soloBoard = await request(app.getHttpServer())
      .get("/api/v1/leaderboard?limit=500&scope=friends")
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(200);
    expect(soloBoard.body.map((e: { username: string }) => e.username)).toEqual([stranger.username]);
  });
});
