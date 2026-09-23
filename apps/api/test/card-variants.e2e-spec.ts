import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Card variants: holo/foil from duplicates (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let seriesId: string;
  let rarityId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    rarityId = rarities.body[0].id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `foil-test-series-${Date.now()}`, name: "Série de test foil", category: "ROLLING_STOCK" })
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
        slug: `foil-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Carte à briller",
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

  it("turns 3 non-foil duplicates into 1 foil card, same rarity, and leaves the player with 1 fewer copy", async () => {
    const cardId = await createCard();
    const player = await registerUser(app, adminToken, "foilplayer1");
    const instanceIds = await grant(player.user.id, cardId, 3);

    const foilable = await request(app.getHttpServer()).get("/api/v1/card-variants/foilable").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const group = foilable.body.find((g: { cardDefinition: { id: string } }) => g.cardDefinition.id === cardId);
    expect(group).toBeTruthy();
    expect(group.count).toBe(3);
    expect(group.instanceIds.sort()).toEqual([...instanceIds].sort());

    const result = await request(app.getHttpServer())
      .post("/api/v1/card-variants/foilify")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardInstanceIds: instanceIds })
      .expect(201);
    expect(result.body.isFoil).toBe(true);
    expect(result.body.cardDefinitionId).toBe(cardId);
    expect(instanceIds).toContain(result.body.id);

    // Exactly 1 copy remains (the foiled one) — 2 were consumed as fuel.
    const collection = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=50`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    const remaining = collection.body.items.filter((i: { cardDefinitionId: string }) => i.cardDefinitionId === cardId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].count).toBe(1);
    expect(remaining[0].isFoil).toBe(true);
    // No longer offered as a foiling source — an already-foil card can't be fuel or target again.
    const foilableAfter = await request(app.getHttpServer())
      .get("/api/v1/card-variants/foilable")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    expect(foilableAfter.body.find((g: { cardDefinition: { id: string } }) => g.cardDefinition.id === cardId)).toBeFalsy();
  });

  it("foil and non-foil copies of the same card stack as separate collection entries", async () => {
    const cardId = await createCard();
    const player = await registerUser(app, adminToken, "foilplayer2");
    const foilSource = await grant(player.user.id, cardId, 3);
    await request(app.getHttpServer())
      .post("/api/v1/card-variants/foilify")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardInstanceIds: foilSource })
      .expect(201);
    await grant(player.user.id, cardId, 2); // 2 more plain copies, alongside the 1 foil

    const collection = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=50`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    const entries = collection.body.items.filter((i: { cardDefinitionId: string }) => i.cardDefinitionId === cardId);
    expect(entries).toHaveLength(2);
    const foilEntry = entries.find((e: { isFoil: boolean }) => e.isFoil);
    const plainEntry = entries.find((e: { isFoil: boolean }) => !e.isFoil);
    expect(foilEntry.count).toBe(1);
    expect(plainEntry.count).toBe(2);
  });

  it("rejects foiling with fewer than the recipe size, cards you don't own, or mismatched cards", async () => {
    const cardA = await createCard();
    const cardB = await createCard();
    const player = await registerUser(app, adminToken, "foilplayer3");
    const other = await registerUser(app, adminToken, "foilplayer4");

    const aInstances = await grant(player.user.id, cardA, 3);
    const bInstances = await grant(player.user.id, cardB, 1);
    const otherInstances = await grant(other.user.id, cardA, 3);

    await request(app.getHttpServer())
      .post("/api/v1/card-variants/foilify")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardInstanceIds: aInstances.slice(0, 2) })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/card-variants/foilify")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardInstanceIds: [...aInstances.slice(0, 2), bInstances[0]] })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/card-variants/foilify")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardInstanceIds: otherInstances })
      .expect(400);
  });
});
