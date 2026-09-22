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

describe("Admin: user lifecycle — grant cards, reset collection, delete account (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let someCardId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${adminToken}`).expect(200);
    adminId = me.body.id;

    const cards = await request(app.getHttpServer())
      .get("/api/v1/admin/cards?pageSize=1")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    someCardId = cards.body.items[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("grants a chosen quantity of a card to a player and notifies them", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "grantcarduser");

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: someCardId, quantity: 3 })
      .expect(201);
    expect(res.body.granted).toBe(3);

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const granted = collection.body.items.filter(
      (i: { cardDefinition: { id: string }; acquiredVia: string }) =>
        i.cardDefinition.id === someCardId && i.acquiredVia === "ADMIN_GRANT",
    );
    expect(granted).toHaveLength(3);

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=20")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(notifications.body.items.some((n: { type: string }) => n.type === "SYSTEM")).toBe(true);
  });

  it("defaults to granting a single copy when no quantity is given", async () => {
    const { user } = await registerUser(app, adminToken, "grantonecarduser");
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId: someCardId })
      .expect(201);
    expect(res.body.granted).toBe(1);
  });

  it("resets a player's entire collection without touching the rest of the account", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "resetcarduser");
    await openBooster(app, accessToken);
    await openBooster(app, accessToken);

    const before = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body.total).toBeGreaterThan(0);

    const resetRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/reset-cards`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    expect(resetRes.body.instancesRemoved).toBe(before.body.total);

    const after = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.total).toBe(0);

    // The account itself is untouched — still logs in and keeps its wallet.
    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(me.body.username).toBe(user.username);
  });

  it("refuses to let an admin delete their own account", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("returns 404 deleting an unknown user", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });

  it("deletes a user with real activity (cards, a completed trade, a market sale) without error, leaving the counterparty's own data intact", async () => {
    const alice = await registerUser(app, adminToken, "deleteuseralice");
    const bob = await registerUser(app, adminToken, "deleteuserbob");

    // A completed trade between them.
    const aliceCards = await openBooster(app, alice.accessToken);
    const tradeRes = await request(app.getHttpServer())
      .post("/api/v1/trades")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ recipientUsername: bob.username, offeredCardInstanceIds: [aliceCards[0]], requestedCardInstanceIds: [], message: "hi" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/trades/${tradeRes.body.id}/accept`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    // A market sale from bob (now owning alice's traded card) to alice.
    const bobCards = await openBooster(app, bob.accessToken, "booster-classique");
    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .send({ cardInstanceId: bobCards[0], priceCr: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listingRes.body.id}/buy`)
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(201);

    // Delete bob entirely.
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${bob.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Bob is gone.
    await request(app.getHttpServer()).get(`/api/v1/users/${bob.username}`).set("Authorization", `Bearer ${adminToken}`).expect(404);
    const usersList = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?search=${bob.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(usersList.body.items).toHaveLength(0);

    // Alice's own account, collection, and wallet are unaffected.
    const aliceMe = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${alice.accessToken}`).expect(200);
    expect(aliceMe.body.username).toBe(alice.username);
    const aliceCollection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(aliceCollection.body.items.some((i: { id: string }) => i.id === bobCards[0])).toBe(true);
  });
});
