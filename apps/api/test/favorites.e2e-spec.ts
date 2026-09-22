import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Favorite cards (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Opens boosters until the player owns at least `count` distinct cards, returning their ids. */
  async function ownAtLeast(accessToken: string, count: number): Promise<string[]> {
    const owned = new Set<string>();
    for (let i = 0; i < 20 && owned.size < count; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/boosters/open")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ boosterSlug: "booster-classique" })
        .expect(201);
      const inv = await request(app.getHttpServer())
        .get("/api/v1/collection?pageSize=100")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      for (const item of inv.body.items) owned.add(item.cardDefinition.id);
    }
    return [...owned];
  }

  it("rejects favoriting a card you don't own", async () => {
    const { accessToken } = await registerUser(app, adminToken, "favnoowneduser");
    await request(app.getHttpServer())
      .post("/api/v1/me/favorites")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: randomUUID() })
      .expect(400);
  });

  it("adds owned cards to favorites, caps at 5, prevents duplicates, and lets you remove one", async () => {
    const { accessToken, username } = await registerUser(app, adminToken, "favuser");
    const ownedIds = await ownAtLeast(accessToken, 6);
    expect(ownedIds.length).toBeGreaterThanOrEqual(6);

    for (const cardId of ownedIds.slice(0, 5)) {
      await request(app.getHttpServer())
        .post("/api/v1/me/favorites")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ cardDefinitionId: cardId })
        .expect(201);
    }

    // A 6th favorite is refused.
    await request(app.getHttpServer())
      .post("/api/v1/me/favorites")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: ownedIds[5] })
      .expect(409);

    // Duplicating an existing favorite is refused too.
    await request(app.getHttpServer())
      .post("/api/v1/me/favorites")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: ownedIds[0] })
      .expect(409);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(me.body.favoriteCards).toHaveLength(5);
    expect(me.body.favoriteCards.map((c: { id: string }) => c.id).sort()).toEqual(ownedIds.slice(0, 5).sort());

    // Shows up on the public profile too.
    const publicProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${username}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(publicProfile.body.favoriteCards).toHaveLength(5);

    // Removing one frees a slot for another.
    await request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${ownedIds[0]}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/me/favorites")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cardDefinitionId: ownedIds[5] })
      .expect(201);

    const meAfter = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(meAfter.body.favoriteCards).toHaveLength(5);
    expect(meAfter.body.favoriteCards.some((c: { id: string }) => c.id === ownedIds[0])).toBe(false);
    expect(meAfter.body.favoriteCards.some((c: { id: string }) => c.id === ownedIds[5])).toBe(true);
  });

  it("returns 404 removing a card that isn't favorited", async () => {
    const { accessToken } = await registerUser(app, adminToken, "favremoveuser");
    await request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${randomUUID()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
