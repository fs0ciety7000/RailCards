import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Collection: missing-cards checklist (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let commonRarityId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    commonRarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSeries() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `missing-test-series-${randomUUID().slice(0, 8)}`, name: "Série de test manquants", category: "PROFESSION" })
      .expect(201);
    return res.body.id as string;
  }

  async function createCard(seriesId: string, name: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `missing-test-card-${randomUUID().slice(0, 8)}`,
        seriesId,
        name,
        description: "…",
        category: "PROFESSION",
        rarityId: commonRarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  async function grant(userId: string, cardDefinitionId: string) {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity: 1 })
      .expect(201);
  }

  it("lists only the un-owned cards of a series, with full details (unlike the spoiler-safe album)", async () => {
    const seriesId = await createSeries();
    const ownedCardId = await createCard(seriesId, "Carte Possédée");
    const missingCardId = await createCard(seriesId, "Carte Manquante");

    const player = await registerUser(app, adminToken, "missingplayer");
    await grant(player.user.id, ownedCardId);

    const missing = await request(app.getHttpServer())
      .get(`/api/v1/collection/missing?seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);

    expect(missing.body).toHaveLength(1);
    const entry = missing.body[0];
    expect(entry.seriesId).toBe(seriesId);
    expect(entry.totalCards).toBe(2);
    expect(entry.missingCount).toBe(1);
    expect(entry.missingCards).toHaveLength(1);
    expect(entry.missingCards[0].id).toBe(missingCardId);
    // Full details are shown — no silhouette hiding, unlike the album view.
    expect(entry.missingCards[0].name).toBe("Carte Manquante");
    expect(entry.missingCards[0].imageUrl).toBeTruthy();
    expect(entry.missingCards.some((c: { id: string }) => c.id === ownedCardId)).toBe(false);
  });

  it("returns an empty missingCards list once every card in a series is owned", async () => {
    const seriesId = await createSeries();
    const onlyCardId = await createCard(seriesId, "Carte Unique");

    const player = await registerUser(app, adminToken, "missingplayer2");
    await grant(player.user.id, onlyCardId);

    const missing = await request(app.getHttpServer())
      .get(`/api/v1/collection/missing?seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);

    expect(missing.body).toHaveLength(1);
    expect(missing.body[0].missingCount).toBe(0);
    expect(missing.body[0].missingCards).toEqual([]);
  });

  it("without a seriesId, covers every active series and skips ones with no published cards", async () => {
    const seriesId = await createSeries();
    await createCard(seriesId, "Carte Globale");

    const player = await registerUser(app, adminToken, "missingplayer3");

    const missing = await request(app.getHttpServer()).get("/api/v1/collection/missing").set("Authorization", `Bearer ${player.accessToken}`).expect(200);

    expect(Array.isArray(missing.body)).toBe(true);
    expect(missing.body.some((s: { seriesId: string }) => s.seriesId === seriesId)).toBe(true);
    // No series entry has zero total cards — those are filtered out.
    expect(missing.body.every((s: { totalCards: number }) => s.totalCards > 0)).toBe(true);
  });
});
