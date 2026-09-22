import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin: delete card (e2e, real Postgres)", () => {
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
      .send({ slug: `del-test-series-${Date.now()}`, name: "Série suppression", category: "ROLLING_STOCK" })
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
        slug: `del-test-card-${nameSuffix}-${Date.now()}`,
        seriesId,
        name: `Carte à supprimer ${nameSuffix}`,
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  it("deletes a card with no owned instances directly, no cascade needed", async () => {
    const cardId = await createCard("no-instances");
    await request(app.getHttpServer()).delete(`/api/v1/admin/cards/${cardId}`).set("Authorization", `Bearer ${adminToken}`).expect(200);

    const listed = await request(app.getHttpServer())
      .get("/api/v1/admin/cards?pageSize=500")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.items.some((c: { id: string }) => c.id === cardId)).toBe(false);
  });

  it("refuses to delete a card with owned instances unless cascade=true, then removes it from the owner's collection", async () => {
    const cardId = await createCard("owned");

    // Build a booster whose pool guarantees drawing exactly this card.
    const booster = await request(app.getHttpServer())
      .post("/api/v1/admin/boosters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `del-test-booster-${Date.now()}`,
        name: "Booster de test suppression",
        description: "…",
        category: "DISCOVERY",
        priceCr: 1,
        cardCount: 1,
        imageUrl: "/booster-placeholders/discovery.svg",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/boosters/${booster.body.id}/pool`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ entries: [{ rarityId, weight: 1, cardDefinitionId: cardId }] })
      .expect(201);

    const { accessToken } = await registerUser(app, adminToken, "cardowner");
    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: booster.body.slug })
      .expect(201);

    const before = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=100")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body.items.some((i: { cardDefinition: { id: string } }) => i.cardDefinition.id === cardId)).toBe(true);

    // Without cascade: refused with a count.
    const refused = await request(app.getHttpServer())
      .delete(`/api/v1/admin/cards/${cardId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);
    expect(refused.body.message).toMatch(/1 exemplaire/);

    // With cascade: succeeds and removes it from the owner's collection.
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/admin/cards/${cardId}?cascade=true`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(deleted.body.instancesRemoved).toBe(1);

    const after = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=100")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.items.some((i: { cardDefinition: { id: string } }) => i.cardDefinition.id === cardId)).toBe(false);
  });

  it("returns 404 for an unknown card id", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/cards/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });
});
