import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin } from "./utils/fixtures";

describe("Admin: reassign a card to a different series (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let rarityId: string;
  let seriesAId: string;
  let seriesBId: string;
  let cardId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    rarityId = rarities.body[0].id;

    const seriesA = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `series-a-${Date.now()}`, name: "Série A", category: "ROLLING_STOCK" })
      .expect(201);
    seriesAId = seriesA.body.id;

    const seriesB = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `series-b-${Date.now()}`, name: "Série B", category: "ROLLING_STOCK" })
      .expect(201);
    seriesBId = seriesB.body.id;

    const card = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `reassign-test-card-${Date.now()}`,
        seriesId: seriesAId,
        name: "Carte à réassigner",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    cardId = card.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("moves a card from one series to another", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/cards/${cardId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ seriesId: seriesBId })
      .expect(200);
    expect(updated.body.seriesId).toBe(seriesBId);
    expect(updated.body.series.id).toBe(seriesBId);

    const listed = await request(app.getHttpServer())
      .get("/api/v1/admin/cards?pageSize=500")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const listedCard = listed.body.items.find((c: { id: string }) => c.id === cardId);
    expect(listedCard.series.id).toBe(seriesBId);
  });

  it("rejects an unknown seriesId", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/cards/${cardId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ seriesId: "00000000-0000-4000-8000-000000000000" })
      .expect(404);
  });
});
