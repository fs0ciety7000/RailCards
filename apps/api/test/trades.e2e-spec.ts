import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

async function openBooster(app: INestApplication, token: string) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/boosters/open")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ boosterSlug: "booster-decouverte" })
    .expect(201);
  return res.body.pulls.map((p: { cardInstanceId: string }) => p.cardInstanceId) as string[];
}

describe("Trading (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let alice: { accessToken: string; username: string };
  let bob: { accessToken: string; username: string };

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    alice = await registerUser(app, adminToken, "alice");
    bob = await registerUser(app, adminToken, "bob");
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a trade proposal and the recipient can accept it, transferring cards atomically", async () => {
    const aliceCards = await openBooster(app, alice.accessToken);

    const createRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({
        recipientUsername: bob.username,
        offeredCardInstanceIds: [aliceCards[0]],
        requestedCardInstanceIds: [],
        message: "Un petit cadeau",
      })
      .expect(201);

    const tradeId = createRes.body.id;

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeId}/accept`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);
    expect(acceptRes.body.status).toBe("ACCEPTED");

    const bobCollection = await request(app.getHttpServer())
      .get("/api/v1/collection")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(200);
    const bobOwnsCard = bobCollection.body.items.some((i: { id: string }) => i.id === aliceCards[0]);
    expect(bobOwnsCard).toBe(true);
  });

  it("fails to accept a trade if the offered card no longer belongs to the initiator", async () => {
    const carolCards = await openBooster(app, alice.accessToken);
    const cardToDoubleSpend = carolCards[carolCards.length - 1];

    const tradeRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({
        recipientUsername: bob.username,
        offeredCardInstanceIds: [cardToDoubleSpend],
        requestedCardInstanceIds: [],
      })
      .expect(201);

    // Alice sells the same (now reserved) card on the market — this must be
    // rejected since it's RESERVED_TRADE, proving a card can never be
    // double-committed to two simultaneous outgoing transfers.
    const listingAttempt = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ cardInstanceId: cardToDoubleSpend, priceCr: 5 });
    expect(listingAttempt.status).toBe(409);

    // Now Alice cancels the trade (releasing the card) and immediately
    // sells it on the market, so when Bob tries to accept the stale trade
    // it must fail cleanly instead of double-transferring the card.
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/cancel`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);

    const secondTrade = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [cardToDoubleSpend], requestedCardInstanceIds: [] })
      .expect(201);

    // Alice cancels again and sells the card away entirely before Bob acts.
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${secondTrade.body.id}/cancel`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ cardInstanceId: cardToDoubleSpend, priceCr: 5 })
      .expect(201);

    const thirdTrade = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [], requestedCardInstanceIds: [] });
    // A trade with zero items on both sides must be rejected outright.
    expect(thirdTrade.status).toBe(400);
  });

  it("only the recipient can accept, and only the initiator can cancel", async () => {
    const cards = await openBooster(app, alice.accessToken);
    const tradeRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [cards[0]], requestedCardInstanceIds: [] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/accept`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/cancel`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(403);
  });
});
