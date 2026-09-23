import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Market price history (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let cardDefinitionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const cards = await request(app.getHttpServer()).get("/api/v1/cards?pageSize=1").set("Authorization", `Bearer ${adminToken}`).expect(200);
    cardDefinitionId = cards.body.items[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("buckets completed sales by day, and reflects a sale that just happened", async () => {
    const seller = await registerUser(app, adminToken, "pricehistseller1");
    const buyer = await registerUser(app, adminToken, "pricehisbuyer1");

    const grant = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${seller.user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity: 1 })
      .expect(201);
    const instanceId = grant.body.instanceIds[0];

    const before = await request(app.getHttpServer())
      .get(`/api/v1/market/price-history/${cardDefinitionId}?days=7`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(200);
    const totalSalesBefore = before.body.reduce((sum: number, row: { salesCount: number }) => sum + row.salesCount, 0);

    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 77 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/market/price-history/${cardDefinitionId}?days=7`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(200);
    const totalSalesAfter = after.body.reduce((sum: number, row: { salesCount: number }) => sum + row.salesCount, 0);
    expect(totalSalesAfter).toBe(totalSalesBefore + 1);

    const todayRow = after.body[after.body.length - 1];
    expect(todayRow.maxPriceCr).toBeGreaterThanOrEqual(77);
    expect(todayRow.minPriceCr).toBeLessThanOrEqual(77);
  });

  it("returns an empty array for a card that's never sold", async () => {
    const newCardSlug = `never-sold-${Date.now()}`;
    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `history-series-${Date.now()}`, name: "Série jamais vendue", category: "ROLLING_STOCK" })
      .expect(201);
    const card = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: newCardSlug,
        seriesId: series.body.id,
        name: "Jamais vendue",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId: rarities.body[0].id,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/market/price-history/${card.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(history.body).toEqual([]);
  });
});
