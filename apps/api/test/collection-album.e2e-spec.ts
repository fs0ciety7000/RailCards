import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Collection album (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("shows a panini-style per-series album: owned cards reveal art, missing ones don't", async () => {
    const { accessToken } = await registerUser(app, adminToken, "albumuser");

    // Open a few boosters so this user owns at least one card.
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/boosters/open")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ boosterSlug: "booster-decouverte" })
        .expect(201);
    }

    const inventory = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=100")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(inventory.body.items.length).toBeGreaterThan(0);
    const ownedInstance = inventory.body.items[0];
    const seriesId = ownedInstance.cardDefinition.seriesId;
    const ownedCardId = ownedInstance.cardDefinition.id;

    const albumSeries = await request(app.getHttpServer())
      .get(`/api/v1/collection/album/${seriesId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(albumSeries.body.seriesId).toBe(seriesId);
    expect(Array.isArray(albumSeries.body.cards)).toBe(true);
    expect(albumSeries.body.cards.length).toBeGreaterThan(0);

    const ownedEntry = albumSeries.body.cards.find((c: { id: string }) => c.id === ownedCardId);
    expect(ownedEntry).toBeTruthy();
    expect(ownedEntry.owned).toBe(true);
    expect(ownedEntry.imageUrl).toBeTruthy();
    expect(ownedEntry.name).toBeTruthy();

    for (const c of albumSeries.body.cards) {
      if (!c.owned) {
        expect(c.imageUrl).toBeNull();
        expect(c.name).toBeNull();
      }
      expect(c.rarity).toBeTruthy();
    }
  });

  it("returns 404 for an unknown series", async () => {
    const { accessToken } = await registerUser(app, adminToken, "albumuser2");
    await request(app.getHttpServer())
      .get(`/api/v1/collection/album/${randomUUID()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
