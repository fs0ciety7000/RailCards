import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Duels: wager a card's combat stat against another player (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let commonRarityId: string;
  let seriesId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer())
      .get("/api/v1/rarities")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    commonRarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `duel-test-series-${Date.now()}`, name: "Série de test duel", category: "PROFESSION" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard(combatStats?: { power: number; reliability: number; charm: number }) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `duel-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Combattant",
        description: "…",
        category: "PROFESSION",
        rarityId: commonRarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    const cardId = res.body.id as string;
    if (combatStats) {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/cards/${cardId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ combatStatsEnabled: true, combatStats })
        .expect(200);
    }
    return cardId;
  }

  async function grant(userId: string, cardDefinitionId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity: 1 })
      .expect(201);
    return res.body.instanceIds[0] as string;
  }

  it("resolves with a clear winner and moves the wager to them", async () => {
    const strongCardId = await createCard({ power: 90, reliability: 10, charm: 10 });
    const weakCardId = await createCard({ power: 10, reliability: 10, charm: 10 });

    const challenger = await registerUser(app, adminToken, "duelchamp");
    const opponent = await registerUser(app, adminToken, "duelvictim");
    const challengerInstance = await grant(challenger.user.id, strongCardId);
    const opponentInstance = await grant(opponent.user.id, weakCardId);

    const before = await Promise.all([
      request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200),
      request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${opponent.accessToken}`).expect(200),
    ]);

    const createRes = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: challengerInstance, wagerCr: 50 })
      .expect(201);
    expect(createRes.body.status).toBe("PENDING");

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/duels/${createRes.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: opponentInstance })
      .expect(201);

    expect(acceptRes.body.status).toBe("ACCEPTED");
    // Power 90 beats power 10 regardless of which stat happened to be
    // picked only if the randomly chosen stat is POWER; reliability/charm
    // are tied at 10 vs 10. So the winner is either the challenger (POWER
    // picked) or nobody (a tie on reliability/charm).
    if (acceptRes.body.stat === "POWER") {
      expect(acceptRes.body.winnerId).toBe(challenger.user.id);
    } else {
      expect(acceptRes.body.winnerId).toBeNull();
    }

    const after = await Promise.all([
      request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200),
      request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${opponent.accessToken}`).expect(200),
    ]);

    if (acceptRes.body.winnerId === challenger.user.id) {
      expect(after[0].body.walletBalance).toBe(before[0].body.walletBalance + 50);
      expect(after[1].body.walletBalance).toBe(before[1].body.walletBalance - 50);
    } else {
      // Tie: no CR moves at all.
      expect(after[0].body.walletBalance).toBe(before[0].body.walletBalance);
      expect(after[1].body.walletBalance).toBe(before[1].body.walletBalance);
    }
  });

  it("ties without moving any CR when both cards have identical stats", async () => {
    const cardAId = await createCard({ power: 42, reliability: 42, charm: 42 });
    const cardBId = await createCard({ power: 42, reliability: 42, charm: 42 });

    const challenger = await registerUser(app, adminToken, "dueltiea");
    const opponent = await registerUser(app, adminToken, "dueltieb");
    const challengerInstance = await grant(challenger.user.id, cardAId);
    const opponentInstance = await grant(opponent.user.id, cardBId);

    const before = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200);

    const createRes = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: challengerInstance, wagerCr: 30 })
      .expect(201);

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/duels/${createRes.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: opponentInstance })
      .expect(201);

    expect(acceptRes.body.winnerId).toBeNull();
    expect(acceptRes.body.challengerValue).toBe(acceptRes.body.opponentValue);

    const after = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200);
    expect(after.body.walletBalance).toBe(before.body.walletBalance);
  });

  it("rejects a challenge with a card that has no combat stats", async () => {
    const noStatsCardId = await createCard();
    const challenger = await registerUser(app, adminToken, "duelnostat");
    const opponent = await registerUser(app, adminToken, "duelnostat2");
    const instance = await grant(challenger.user.id, noStatsCardId);

    await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: instance, wagerCr: 10 })
      .expect(400);
  });

  it("rejects challenging yourself", async () => {
    const cardId = await createCard({ power: 50, reliability: 50, charm: 50 });
    const player = await registerUser(app, adminToken, "duelself");
    const instance = await grant(player.user.id, cardId);

    await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ opponentUsername: player.username, cardInstanceId: instance, wagerCr: 10 })
      .expect(400);
  });

  it("rejects a challenger who can't cover the wager", async () => {
    const cardId = await createCard({ power: 50, reliability: 50, charm: 50 });
    const challenger = await registerUser(app, adminToken, "duelpoor");
    const opponent = await registerUser(app, adminToken, "dueltarget");
    const instance = await grant(challenger.user.id, cardId);

    // registerUser's fresh account only has the welcome bonus balance; ask
    // for far more than that.
    await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: instance, wagerCr: 999_999 })
      .expect(400);
  });

  it("lets the opponent decline without moving any CR, and the challenger cancel a still-pending duel", async () => {
    const cardId = await createCard({ power: 50, reliability: 50, charm: 50 });
    const challenger = await registerUser(app, adminToken, "duelpolite");
    const opponent = await registerUser(app, adminToken, "duelpolite2");
    const instance = await grant(challenger.user.id, cardId);

    const before = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200);

    const duel1 = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: instance, wagerCr: 20 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel1.body.id}/decline`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .expect(201);

    const duel2 = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: instance, wagerCr: 20 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel2.body.id}/cancel`)
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .expect(201);

    const after = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${challenger.accessToken}`).expect(200);
    expect(after.body.walletBalance).toBe(before.body.walletBalance);

    // A declined/cancelled duel can't be accepted afterward.
    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel1.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: instance })
      .expect(409);
  });

  it("rejects accepting with a card the opponent does not own", async () => {
    const cardId = await createCard({ power: 50, reliability: 50, charm: 50 });
    const challenger = await registerUser(app, adminToken, "dueltheft");
    const opponent = await registerUser(app, adminToken, "dueltheft2");
    const bystander = await registerUser(app, adminToken, "dueltheft3");
    const challengerInstance = await grant(challenger.user.id, cardId);
    const bystanderInstance = await grant(bystander.user.id, cardId);

    const duel = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: challengerInstance, wagerCr: 10 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: bystanderInstance })
      .expect(400);
  });

  it("lets an admin delete a player who has a resolved duel on record", async () => {
    const cardId = await createCard({ power: 60, reliability: 60, charm: 60 });
    const challenger = await registerUser(app, adminToken, "dueldeleteme");
    const opponent = await registerUser(app, adminToken, "dueldeletesurvivor");
    const challengerInstance = await grant(challenger.user.id, cardId);
    const opponentInstance = await grant(opponent.user.id, cardId);

    const duel = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: challengerInstance, wagerCr: 15 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: opponentInstance })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${challenger.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // The surviving opponent's own account and card are untouched.
    await request(app.getHttpServer())
      .get(`/api/v1/users/${opponent.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
