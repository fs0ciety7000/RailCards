import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

// A fresh registration auto-grants the founders card while the cutoff hasn't
// passed (see AuthService.grantFoundersCardIfEligible), adding one instance
// on top of whatever's granted in the test itself.
const FOUNDERS_CARD_INSTANCES = new Date() < new Date(GAME_CONSTANTS.FOUNDERS_CARD_CUTOFF_ISO) ? 1 : 0;

describe("Collection: duplicate cards stack across pagination (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let rarityId: string;
  let seriesId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    rarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `stack-test-series-${Date.now()}`, name: "Série de test empilement", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard(nameSuffix: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `stack-test-card-${nameSuffix}-${Date.now()}`,
        seriesId,
        name: `Carte empilement ${nameSuffix}`,
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  it("groups every copy of a card into one entry with an accurate count, even with a tiny page size", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "stackuser");
    const cardA = await createCard("a");
    const cardB = await createCard("b");

    // 5 copies of card A, 2 of card B — well beyond what a pageSize of 2
    // could show as raw rows without grouping.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardA, quantity: 5 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardB, quantity: 2 })
      .expect(201);

    // With grouping, there are only 2 distinct (card, state) groups within
    // this test's own series, so a pageSize of 2 must show both on a
    // single page — no page-boundary split, and the counts must be exact.
    // Scoped to seriesId to ignore the unrelated founders-card grant every
    // fresh registration receives (see FOUNDERS_CARD_INSTANCES above).
    const res = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=2&seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);

    const groupA = res.body.items.find((i: { cardDefinition: { id: string } }) => i.cardDefinition.id === cardA);
    const groupB = res.body.items.find((i: { cardDefinition: { id: string } }) => i.cardDefinition.id === cardB);
    expect(groupA.count).toBe(5);
    expect(groupB.count).toBe(2);

    // Sanity check against the raw instance count via reset-cards, which
    // operates on individual CardInstance rows, not groups.
    const resetRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/reset-cards`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    expect(resetRes.body.instancesRemoved).toBe(7 + FOUNDERS_CARD_INSTANCES);
  });

  it("keeps reserved and available copies of the same card in separate groups", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "stackstateuser");
    const card = await createCard("state");

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: card, quantity: 3 })
      .expect(201);

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const instanceId = collection.body.items.find(
      (i: { cardDefinition: { id: string } }) => i.cardDefinition.id === card,
    ).id;

    await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 5 })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groups = after.body.items.filter((i: { cardDefinition: { id: string } }) => i.cardDefinition.id === card);
    expect(groups).toHaveLength(2);
    const available = groups.find((g: { state: string }) => g.state === "AVAILABLE");
    const reserved = groups.find((g: { state: string }) => g.state === "RESERVED_MARKET");
    expect(available.count).toBe(2);
    expect(reserved.count).toBe(1);
  });
});
