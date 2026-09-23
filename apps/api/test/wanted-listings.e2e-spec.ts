import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Wanted listings: public want-ad board (e2e, real Postgres)", () => {
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
      .send({ slug: `wanted-test-series-${Date.now()}`, name: "Série de test recherche", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard(status: "DRAFT" | "PUBLISHED" = "PUBLISHED") {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `wanted-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Carte recherchée",
        description: "…",
        category: "ROLLING_STOCK",
        rarityId,
        imageUrl: "/card-placeholders/common.svg",
        status,
      })
      .expect(201);
    return res.body.id as string;
  }

  it("posts a wanted listing that appears on the public board, and rejects a duplicate open one", async () => {
    const cardId = await createCard();
    const { accessToken } = await registerUser(app, adminToken, "wantposter");

    const createRes = await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId, note: "Je prends contre n'importe quelle carte rare" })
      .expect(201);
    expect(createRes.body.status).toBe("OPEN");

    const boardRes = await request(app.getHttpServer())
      .get(`/api/v1/wanted?cardDefinitionId=${cardId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(boardRes.body.items.some((l: { id: string }) => l.id === createRes.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(409);
  });

  it("rejects a wanted listing for an unpublished card", async () => {
    const draftCardId = await createCard("DRAFT");
    const { accessToken } = await registerUser(app, adminToken, "wantdraft");

    await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: draftCardId })
      .expect(400);
  });

  it("lets the poster cancel or fulfill their own listing, hiding it from the public board either way", async () => {
    const cardId = await createCard();
    const { accessToken } = await registerUser(app, adminToken, "wantcloser");

    const listing1 = await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing1.body.id}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const listing2 = await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing2.body.id}/fulfill`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const board = await request(app.getHttpServer())
      .get(`/api/v1/wanted?cardDefinitionId=${cardId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(board.body.items).toHaveLength(0);

    const mine = await request(app.getHttpServer()).get("/api/v1/wanted/mine").set("Authorization", `Bearer ${accessToken}`).expect(200);
    const statuses = mine.body
      .filter((l: { id: string }) => l.id === listing1.body.id || l.id === listing2.body.id)
      .map((l: { status: string }) => l.status)
      .sort();
    expect(statuses).toEqual(["CANCELLED", "FULFILLED"]);
  });

  it("rejects someone other than the poster cancelling or fulfilling a listing", async () => {
    const cardId = await createCard();
    const poster = await registerUser(app, adminToken, "wantowner");
    const stranger = await registerUser(app, adminToken, "wantstranger");

    const listing = await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${poster.accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing.body.id}/cancel`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing.body.id}/fulfill`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(403);
  });

  it("rejects re-cancelling an already-closed listing", async () => {
    const cardId = await createCard();
    const { accessToken } = await registerUser(app, adminToken, "wantreclose");

    const listing = await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing.body.id}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${listing.body.id}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);
  });

  it("lets an admin cascade-delete a card that has a wanted listing on record", async () => {
    const cardId = await createCard();
    const { accessToken } = await registerUser(app, adminToken, "wantcarddel");

    await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/cards/${cardId}?cascade=true`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
