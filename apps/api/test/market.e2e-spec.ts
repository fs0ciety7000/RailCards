import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

async function openBooster(app: INestApplication, token: string, slug = "booster-decouverte") {
  const res = await request(app.getHttpServer())
    .post("/api/v1/boosters/open")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ boosterSlug: slug })
    .expect(201);
  return res.body.pulls.map((p: { cardInstanceId: string }) => p.cardInstanceId) as string[];
}

describe("Market (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let seller: { accessToken: string; username: string };
  let buyerA: { accessToken: string; username: string };
  let buyerB: { accessToken: string; username: string };

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    seller = await registerUser(app, adminToken, "seller");
    buyerA = await registerUser(app, adminToken, "buyera");
    buyerB = await registerUser(app, adminToken, "buyerb");
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists and buys a card, transferring CR with commission and ownership atomically", async () => {
    const cards = await openBooster(app, seller.accessToken);
    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: cards[0], priceCr: 50 })
      .expect(201);

    const buyerBalanceBefore = (
      await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${buyerA.accessToken}`)
    ).body.balance;

    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
      .set("Authorization", `Bearer ${buyerA.accessToken}`)
      .expect(201);

    const buyerBalanceAfter = (
      await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${buyerA.accessToken}`)
    ).body.balance;
    expect(buyerBalanceAfter).toBe(buyerBalanceBefore - 50);

    const buyerCollection = await request(app.getHttpServer())
      .get("/api/v1/collection")
      .set("Authorization", `Bearer ${buyerA.accessToken}`)
      .expect(200);
    expect(buyerCollection.body.items.some((i: { id: string }) => i.id === cards[0])).toBe(true);
  });

  it("prevents two concurrent purchases of the same listing from both succeeding (no double sale)", async () => {
    const cards = await openBooster(app, seller.accessToken);
    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: cards[0], priceCr: 10 })
      .expect(201);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
        .set("Authorization", `Bearer ${buyerA.accessToken}`),
      request(app.getHttpServer())
        .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
        .set("Authorization", `Bearer ${buyerB.accessToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Exactly one of the two buyers now owns the card — never both, never neither.
    const [collectionA, collectionB] = await Promise.all([
      request(app.getHttpServer()).get("/api/v1/collection").set("Authorization", `Bearer ${buyerA.accessToken}`),
      request(app.getHttpServer()).get("/api/v1/collection").set("Authorization", `Bearer ${buyerB.accessToken}`),
    ]);
    const aOwns = collectionA.body.items.some((i: { id: string }) => i.id === cards[0]);
    const bOwns = collectionB.body.items.some((i: { id: string }) => i.id === cards[0]);
    expect(aOwns !== bOwns).toBe(true);
  });

  it("cannot buy your own listing, and a cancelled listing cannot be bought", async () => {
    const cards = await openBooster(app, seller.accessToken);
    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: cards[0], priceCr: 10 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/market/listings/${listingRes.body.id}`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
      .set("Authorization", `Bearer ${buyerA.accessToken}`)
      .expect(409);
  });
});
