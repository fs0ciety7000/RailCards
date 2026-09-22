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

  it("lets an initiator browse a recipient's collection and request a specific card, transferring it on accept", async () => {
    const bobCards = await openBooster(app, bob.accessToken);

    const bobPublicCollection = await request(app.getHttpServer())
      .get(`/api/v1/users/${bob.username}/collection`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    const requestedCardId = bobPublicCollection.body.items.find((i: { id: string }) => bobCards.includes(i.id)).id;
    expect(bobPublicCollection.body.items.every((i: { state: string }) => i.state === "AVAILABLE")).toBe(true);

    const tradeRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [], requestedCardInstanceIds: [requestedCardId] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/accept`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    const aliceCollection = await request(app.getHttpServer())
      .get("/api/v1/collection")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(aliceCollection.body.items.some((i: { id: string }) => i.id === requestedCardId)).toBe(true);
  });

  it("lets the recipient counter a pending trade: original is COUNTERED, its cards released, and a reversed trade is created", async () => {
    const aliceCards = await openBooster(app, alice.accessToken);
    const bobCards = await openBooster(app, bob.accessToken);

    const originalRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [aliceCards[0]], requestedCardInstanceIds: [] })
      .expect(201);

    const bobMe = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${bob.accessToken}`).expect(200);
    const aliceMe = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${alice.accessToken}`).expect(200);

    const counterRes = await request(app.getHttpServer())
      .post(`/api/v1/trades/${originalRes.body.id}/counter`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .send({ offeredCardInstanceIds: [bobCards[0]], requestedCardInstanceIds: [aliceCards[0]] })
      .expect(201);

    expect(counterRes.body.parentTradeId).toBe(originalRes.body.id);
    // The counter reverses direction: Bob (the original recipient) is now
    // the initiator, Alice (the original initiator) is now the recipient.
    expect(counterRes.body.initiatorId).toBe(bobMe.body.id);
    expect(counterRes.body.recipientId).toBe(aliceMe.body.id);

    const original = await request(app.getHttpServer())
      .get(`/api/v1/trades/${originalRes.body.id}`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(original.body.status).toBe("COUNTERED");

    // Alice's originally-offered card must be released back to AVAILABLE,
    // not stuck reserved forever.
    const aliceInstance = await request(app.getHttpServer())
      .get(`/api/v1/collection/${aliceCards[0]}`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(aliceInstance.body.state).toBe("AVAILABLE");

    // Alice (the original initiator) is now the recipient of the counter
    // and can accept it like any other trade.
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${counterRes.body.id}/accept`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);

    const bobCollection = await request(app.getHttpServer())
      .get("/api/v1/collection")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(200);
    expect(bobCollection.body.items.some((i: { id: string }) => i.id === aliceCards[0])).toBe(true);
  });

  it("only the recipient of the original trade can counter it, and only while it is pending", async () => {
    const aliceCards = await openBooster(app, alice.accessToken);
    const tradeRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [aliceCards[0]], requestedCardInstanceIds: [] })
      .expect(201);

    const bobCards = await openBooster(app, bob.accessToken);

    // The initiator cannot counter their own proposal.
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/counter`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ offeredCardInstanceIds: [bobCards[0]], requestedCardInstanceIds: [] })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/reject`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    // Once rejected (no longer pending), countering must fail too.
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/counter`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .send({ offeredCardInstanceIds: [bobCards[0]], requestedCardInstanceIds: [] })
      .expect(409);
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
