import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Lore book: flavor-text encyclopedia unlocked by ownership (e2e, real Postgres)", () => {
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
      .send({ slug: `lore-test-series-${randomUUID().slice(0, 8)}`, name: "Série de test lore", category: "PROFESSION" })
      .expect(201);
    return res.body.id as string;
  }

  async function createCard(seriesId: string, name: string, flavorText?: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `lore-test-card-${randomUUID().slice(0, 8)}`,
        seriesId,
        name,
        description: "…",
        ...(flavorText ? { flavorText } : {}),
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

  it("redacts flavor text for un-owned cards but reveals name/art, and unlocks the text once owned", async () => {
    const seriesId = await createSeries();
    const ownedCardId = await createCard(seriesId, "Carte Possédée", "L'histoire de la carte possédée.");
    const lockedCardId = await createCard(seriesId, "Carte Verrouillée", "L'histoire de la carte verrouillée.");
    // A card with no flavor text at all shouldn't appear in the lore book.
    await createCard(seriesId, "Carte Sans Histoire");
    // Nor should one with an empty-string flavor text — that's not a real
    // lore entry either, even though it isn't `null` in the database.
    await createCard(seriesId, "Carte Histoire Vide", "");

    const player = await registerUser(app, adminToken, "loreplayer");
    await grant(player.user.id, ownedCardId);

    const book = await request(app.getHttpServer())
      .get(`/api/v1/lore?seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);

    expect(book.body).toHaveLength(1);
    const entry = book.body[0];
    expect(entry.seriesId).toBe(seriesId);
    expect(entry.totalEntries).toBe(2);
    expect(entry.unlockedCount).toBe(1);
    expect(entry.entries).toHaveLength(2);

    const owned = entry.entries.find((e: { id: string }) => e.id === ownedCardId);
    expect(owned.unlocked).toBe(true);
    expect(owned.name).toBe("Carte Possédée");
    expect(owned.flavorText).toBe("L'histoire de la carte possédée.");

    const locked = entry.entries.find((e: { id: string }) => e.id === lockedCardId);
    expect(locked.unlocked).toBe(false);
    // The card itself is still recognizable — only the lore text is redacted.
    expect(locked.name).toBe("Carte Verrouillée");
    expect(locked.imageUrl).toBeTruthy();
    expect(locked.flavorText).toBeNull();
  });

  it("without a seriesId, covers every active series but only ones with lore-bearing cards", async () => {
    const withLoreSeriesId = await createSeries();
    await createCard(withLoreSeriesId, "Carte Avec Histoire", "Une histoire.");
    const withoutLoreSeriesId = await createSeries();
    await createCard(withoutLoreSeriesId, "Carte Sans Histoire Du Tout");

    const player = await registerUser(app, adminToken, "loreplayer2");
    const book = await request(app.getHttpServer()).get("/api/v1/lore").set("Authorization", `Bearer ${player.accessToken}`).expect(200);

    expect(book.body.some((s: { seriesId: string }) => s.seriesId === withLoreSeriesId)).toBe(true);
    expect(book.body.some((s: { seriesId: string }) => s.seriesId === withoutLoreSeriesId)).toBe(false);
  });
});
