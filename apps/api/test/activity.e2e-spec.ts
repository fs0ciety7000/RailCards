import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Activity feed: public network events (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let rarityId: string;
  let seriesId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    rarityId = rarities.body[0].id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `activity-test-series-${Date.now()}`, name: "Série de test activité", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `activity-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Carte de test activité",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  async function grant(userId: string, cardDefinitionId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity: 1 })
      .expect(201);
    return res.body.instanceIds[0] as string;
  }

  it("surfaces a completed market sale in the feed", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "activityseller");
    const buyer = await registerUser(app, adminToken, "activitybuyer");
    const instanceId = await grant(seller.user.id, cardId);

    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 20 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    const feed = await request(app.getHttpServer()).get("/api/v1/activity?limit=100").set("Authorization", `Bearer ${buyer.accessToken}`).expect(200);
    const sale = feed.body.find(
      (e: { type: string; buyer?: { username: string } }) => e.type === "MARKET_SALE" && e.buyer?.username === buyer.username,
    );
    expect(sale).toBeTruthy();
    expect(sale.seller.username).toBe(seller.username);
    expect(sale.priceCr).toBe(20);
  });

  it("excludes events from a player who has hidden their profile", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "activityhidden");
    const buyer = await registerUser(app, adminToken, "activityvisible");
    const instanceId = await grant(seller.user.id, cardId);

    await request(app.getHttpServer())
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ isPublic: false })
      .expect(200);

    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 15 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    const feed = await request(app.getHttpServer()).get("/api/v1/activity?limit=100").set("Authorization", `Bearer ${buyer.accessToken}`).expect(200);
    const leaked = feed.body.find((e: { type: string; seller?: { username: string } }) => e.type === "MARKET_SALE" && e.seller?.username === seller.username);
    expect(leaked).toBeUndefined();
  });

  it("surfaces a resolved duel with a clear winner", async () => {
    const cardId = await createCard();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/cards/${cardId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ combatStatsEnabled: true, combatStats: { power: 50, reliability: 50, charm: 50 } })
      .expect(200);
    const strongCardId = await createCard();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/cards/${strongCardId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ combatStatsEnabled: true, combatStats: { power: 99, reliability: 99, charm: 99 } })
      .expect(200);

    const challenger = await registerUser(app, adminToken, "activityduelc");
    const opponent = await registerUser(app, adminToken, "activityduelo");
    const challengerInstance = await grant(challenger.user.id, strongCardId);
    const opponentInstance = await grant(opponent.user.id, cardId);

    const duel = await request(app.getHttpServer())
      .post("/api/v1/duels")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .send({ opponentUsername: opponent.username, cardInstanceId: challengerInstance, wagerCr: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/duels/${duel.body.id}/accept`)
      .set("Authorization", `Bearer ${opponent.accessToken}`)
      .send({ cardInstanceId: opponentInstance })
      .expect(201);

    const feed = await request(app.getHttpServer())
      .get("/api/v1/activity?limit=100")
      .set("Authorization", `Bearer ${challenger.accessToken}`)
      .expect(200);
    const found = feed.body.find(
      (e: { type: string; winner?: { username: string } }) => e.type === "DUEL_RESOLVED" && e.winner?.username === challenger.username,
    );
    expect(found).toBeTruthy();
    expect(found.loser.username).toBe(opponent.username);
    expect(found.wagerCr).toBe(10);
  });
});
