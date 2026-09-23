import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Guild activity feed (e2e, real Postgres)", () => {
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
      .send({ slug: `guild-activity-series-${Date.now()}`, name: "Série activité guilde", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueTag(prefix: string) {
    return `${prefix}${Math.random().toString(36).slice(2, 4)}`.toUpperCase().slice(0, 5);
  }

  async function createCard() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `guild-activity-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Carte activité guilde",
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

  it("surfaces member joins, quest step completions, and filtered network activity — but never outsiders' activity", async () => {
    const leader = await registerUser(app, adminToken, "gactleader1");
    const member = await registerUser(app, adminToken, "gactmember1");
    const outsider = await registerUser(app, adminToken, "gactoutsider1");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Guilde Activité ${Date.now()}`, tag: uniqueTag("GA") })
      .expect(201);
    const joinedAtFloor = new Date();
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    // A market sale between the leader and member should show up (both are guild members).
    const cardId = await createCard();
    const instanceId = await grant(leader.user.id, cardId);
    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 15 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/buy`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    // A quest step completed by the member should show up too.
    const questSlug = `guild-activity-quest-${Date.now()}`;
    await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: questSlug,
        title: "Quête de test guilde",
        description: "…",
        steps: [{ order: 1, title: "Se connecter", narrative: "…", goalType: "LOGIN", goalCount: 1, rewardCr: 0, rewardXp: 0 }],
      })
      .expect(201);
    const freshLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: member.email, password: "Abcdef1234" })
      .expect(201);
    const memberToken2 = freshLogin.body.accessToken as string;

    // An outsider's sale must never leak into the guild's feed.
    const outsiderCardId = await createCard();
    const outsiderInstance = await grant(outsider.user.id, outsiderCardId);
    const outsiderListing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .send({ cardInstanceId: outsiderInstance, priceCr: 15 })
      .expect(201);
    const buyer2 = await registerUser(app, adminToken, "gactbuyer1");
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${outsiderListing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer2.accessToken}`)
      .expect(201);

    const feed = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}/activity?limit=100`)
      .set("Authorization", `Bearer ${memberToken2}`)
      .expect(200);

    const joinEvent = feed.body.find((e: { type: string; member?: { username: string } }) => e.type === "GUILD_MEMBER_JOINED" && e.member?.username === member.username);
    expect(joinEvent).toBeTruthy();
    expect(new Date(joinEvent.occurredAt).getTime()).toBeGreaterThanOrEqual(joinedAtFloor.getTime());

    const questEvent = feed.body.find((e: { type: string; member?: { username: string } }) => e.type === "QUEST_STEP_COMPLETED" && e.member?.username === member.username);
    expect(questEvent).toBeTruthy();
    expect(questEvent.stepTitle).toBe("Se connecter");

    const sale = feed.body.find((e: { type: string; buyer?: { username: string } }) => e.type === "MARKET_SALE" && e.buyer?.username === member.username);
    expect(sale).toBeTruthy();
    expect(sale.seller.username).toBe(leader.username);

    const leaked = feed.body.find((e: { type: string; seller?: { username: string } }) => e.type === "MARKET_SALE" && e.seller?.username === outsider.username);
    expect(leaked).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}/activity`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(403);
  });
});
