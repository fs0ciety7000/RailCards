import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin: numbered signature cards for special events (e2e, real Postgres)", () => {
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
      .send({ slug: `sig-test-series-${randomUUID().slice(0, 8)}`, name: "Série de test signature", category: "PROFESSION" })
      .expect(201);
    return res.body.id as string;
  }

  async function createCard(seriesId: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `sig-test-card-${randomUUID().slice(0, 8)}`,
        seriesId,
        name: "Carte Signature",
        description: "…",
        category: "PROFESSION",
        rarityId: commonRarityId,
        imageUrl: "/card-placeholders/common.svg",
        status: "PUBLISHED",
      })
      .expect(201);
    return res.body.id as string;
  }

  it("denies a non-admin from minting a signature card", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const player = await registerUser(app, adminToken, "sigdeny");
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${player.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(403);
  });

  it("mints a true 1/1: the first mint fixes the edition size, and a second mint for the same card is refused", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const winner = await registerUser(app, adminToken, "sigwinner");
    const runnerUp = await registerUser(app, adminToken, "sigrunnerup");

    const minted = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${winner.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, editionSize: 1 })
      .expect(201);
    expect(minted.body.signatureNumber).toBe(1);
    expect(minted.body.signatureEdition).toBe(1);

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=100")
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .expect(200);
    const instance = collection.body.items.find((i: { cardDefinitionId: string }) => i.cardDefinitionId === cardId);
    expect(instance).toBeTruthy();
    expect(instance.isSignature).toBe(true);
    expect(instance.signatureNumber).toBe(1);
    expect(instance.signatureEdition).toBe(1);

    // The edition is sold out — a second mint for the same card is refused,
    // even for a different recipient and even if a larger size is requested.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${runnerUp.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, editionSize: 5 })
      .expect(409);
  });

  it("mints a small numbered run (not just 1/1), incrementing signatureNumber and keeping the edition size the first mint fixed", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const first = await registerUser(app, adminToken, "sigrunfirst");
    const second = await registerUser(app, adminToken, "sigrunsecond");
    const third = await registerUser(app, adminToken, "sigrunthird");

    const mint1 = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${first.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, editionSize: 3 })
      .expect(201);
    expect(mint1.body).toEqual(expect.objectContaining({ signatureNumber: 1, signatureEdition: 3 }));

    // A later mint's editionSize is ignored — the size fixed by the first mint wins.
    const mint2 = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${second.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, editionSize: 50 })
      .expect(201);
    expect(mint2.body).toEqual(expect.objectContaining({ signatureNumber: 2, signatureEdition: 3 }));

    const mint3 = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${third.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);
    expect(mint3.body).toEqual(expect.objectContaining({ signatureNumber: 3, signatureEdition: 3 }));

    // The 3-slot edition is now exhausted.
    const fourth = await registerUser(app, adminToken, "sigrunfourth");
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${fourth.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(409);
  });

  it("defaults to a 1/1 when no editionSize is given", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const winner = await registerUser(app, adminToken, "sigdefault");

    const minted = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${winner.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);
    expect(minted.body).toEqual(expect.objectContaining({ signatureNumber: 1, signatureEdition: 1 }));
  });

  it("never stacks a signature instance with an ordinary duplicate of the same card, even in the same state", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const player = await registerUser(app, adminToken, "signostack");

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${player.user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, quantity: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${player.user.id}/mint-signature-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId })
      .expect(201);

    const collection = await request(app.getHttpServer())
      .get(`/api/v1/collection?pageSize=50&seriesId=${seriesId}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    const groups = collection.body.items.filter((i: { cardDefinitionId: string }) => i.cardDefinitionId === cardId);
    // Two separate groups (not one merged "×2" stack): the ordinary copy and
    // the signature copy, each with its own count of 1.
    expect(groups).toHaveLength(2);
    for (const g of groups) expect(g.count).toBe(1);
    const signatureGroup = groups.find((g: { isSignature: boolean }) => g.isSignature);
    const ordinaryGroup = groups.find((g: { isSignature: boolean }) => !g.isSignature);
    expect(signatureGroup.signatureNumber).toBe(1);
    expect(signatureGroup.signatureEdition).toBe(1);
    expect(ordinaryGroup.signatureNumber).toBeNull();
  });

  it("does not mark an ordinary admin-granted copy of the same card as a signature", async () => {
    const seriesId = await createSeries();
    const cardId = await createCard(seriesId);
    const player = await registerUser(app, adminToken, "sigordinary");

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${player.user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: cardId, quantity: 1 })
      .expect(201);

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=100")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    const instance = collection.body.items.find((i: { cardDefinitionId: string }) => i.cardDefinitionId === cardId);
    expect(instance.isSignature).toBe(false);
    expect(instance.signatureNumber).toBeNull();
    expect(instance.signatureEdition).toBeNull();
  });
});
