import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Craft: fuse duplicates into a higher rarity card (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let commonRarityId: string;
  let uncommonRarityId: string;
  let mythicRarityId: string;
  let seriesId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer())
      .get("/api/v1/rarities")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    commonRarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;
    uncommonRarityId = rarities.body.find((r: { code: string }) => r.code === "UNCOMMON").id;
    mythicRarityId = rarities.body.find((r: { code: string }) => r.code === "MYTHIC").id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `craft-test-series-${Date.now()}`, name: "Série de test fusion", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;

    // At least one published UNCOMMON card must exist for COMMON->UNCOMMON
    // crafts to have somewhere to land.
    await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `craft-test-uncommon-${Date.now()}`,
        seriesId,
        name: "Cible de fusion",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId: uncommonRarityId,
        imageUrl: "/card-placeholders/uncommon.svg",
        status: "PUBLISHED",
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard(rarityId: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `craft-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Source de fusion",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  async function grant(userId: string, cardDefinitionId: string, quantity: number) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity })
      .expect(201);
    return res.body.instanceIds as string[];
  }

  it("fuses 3 same-rarity duplicates into 1 card of the next rarity tier, consuming the inputs", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "crafter");
    const commonCardId = await createCard(commonRarityId);
    const instanceIds = await grant(user.id, commonCardId, 3);
    expect(instanceIds).toHaveLength(3);

    const before = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=50&seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body.total).toBe(1); // 3 copies of one card = 1 stacked group

    // The next-rarity-up pick is deliberately catalog-wide (not scoped to
    // this series), so the crafted card can land in any UNCOMMON card in
    // the whole test database — assert on the specific instance, not on a
    // series-scoped list.
    const craftRes = await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(201);
    expect(craftRes.body.cardDefinition.rarity.code).toBe("UNCOMMON");
    expect(craftRes.body.acquiredVia).toBe("CRAFT");
    expect(craftRes.body.ownerId).toBe(user.id);

    await request(app.getHttpServer())
      .get(`/api/v1/collection/${craftRes.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // The 3 sacrificed COMMON instances are gone.
    for (const id of instanceIds) {
      await request(app.getHttpServer()).get(`/api/v1/collection/${id}`).set("Authorization", `Bearer ${accessToken}`).expect(404);
    }

    const after = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=50&seriesId=${seriesId}&rarity=COMMON`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.total).toBe(0);

    // Replaying the same (now-consumed) instance ids must fail cleanly.
    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(404);
  });

  it("rejects crafting with cards of mixed rarities", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "mixedrarity");
    const commonCardId = await createCard(commonRarityId);
    const [a, b] = await grant(user.id, commonCardId, 2);
    const uncommonCardId = await createCard(uncommonRarityId);
    const [c] = await grant(user.id, uncommonCardId, 1);

    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: [a, b, c] })
      .expect(400);
  });

  it("rejects crafting cards that aren't AVAILABLE (e.g. listed on the market)", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "reservedcraft");
    const commonCardId = await createCard(commonRarityId);
    const instanceIds = await grant(user.id, commonCardId, 3);

    await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceId: instanceIds[0], priceCr: 10 })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(400);
  });

  it("rejects crafting cards the requester does not own", async () => {
    const owner = await registerUser(app, adminToken, "craftowner");
    const other = await registerUser(app, adminToken, "craftother");
    const commonCardId = await createCard(commonRarityId);
    const instanceIds = await grant(owner.user.id, commonCardId, 3);

    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(400);
  });

  it("refuses to craft MYTHIC cards since nothing is above them", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "mythiccrafter");
    const mythicCardId = await createCard(mythicRarityId);
    const instanceIds = await grant(user.id, mythicCardId, 3);

    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(400);
  });

  it("lists card definitions with enough duplicates to craft, excluding MYTHIC", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "craftable");
    const commonCardId = await createCard(commonRarityId);
    await grant(user.id, commonCardId, 3);
    const mythicCardId = await createCard(mythicRarityId);
    await grant(user.id, mythicCardId, 3);
    // Only 2 copies — not enough to craft.
    const otherCommonId = await createCard(commonRarityId);
    await grant(user.id, otherCommonId, 2);

    const res = await request(app.getHttpServer())
      .get("/api/v1/craft/craftable")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const slugs = res.body.map((g: { cardDefinition: { id: string } }) => g.cardDefinition.id);
    expect(slugs).toContain(commonCardId);
    expect(slugs).not.toContain(mythicCardId);
    expect(slugs).not.toContain(otherCommonId);
    const group = res.body.find((g: { cardDefinition: { id: string } }) => g.cardDefinition.id === commonCardId);
    expect(group.count).toBe(3);
    expect(group.instanceIds).toHaveLength(3);
  });

  it("rejects a payload that isn't exactly CRAFT_RECIPE_SIZE ids", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "wrongcount");
    const commonCardId = await createCard(commonRarityId);
    const instanceIds = await grant(user.id, commonCardId, 2);

    await request(app.getHttpServer())
      .post("/api/v1/craft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(400);
  });
});
