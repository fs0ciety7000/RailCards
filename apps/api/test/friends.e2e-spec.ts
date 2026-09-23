import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Friends: requests, list, and removal (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("goes through the full lifecycle: request, incoming/outgoing lists, accept, mutual listing, and removal", async () => {
    const alice = await registerUser(app, adminToken, "friendalice");
    const bob = await registerUser(app, adminToken, "friendbob");

    const sent = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ username: bob.username })
      .expect(201);
    expect(sent.body.status).toBe("PENDING");

    const outgoing = await request(app.getHttpServer())
      .get("/api/v1/friends/requests?direction=outgoing")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(outgoing.body.some((r: { user: { username: string } }) => r.user.username === bob.username)).toBe(true);

    const incoming = await request(app.getHttpServer())
      .get("/api/v1/friends/requests?direction=incoming")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(200);
    const incomingEntry = incoming.body.find((r: { user: { username: string } }) => r.user.username === alice.username);
    expect(incomingEntry).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${incomingEntry.id}/accept`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(201);

    // Both sides now see each other in their friends list.
    const aliceFriends = await request(app.getHttpServer()).get("/api/v1/friends").set("Authorization", `Bearer ${alice.accessToken}`).expect(200);
    expect(aliceFriends.body.some((f: { username: string }) => f.username === bob.username)).toBe(true);
    const bobFriends = await request(app.getHttpServer()).get("/api/v1/friends").set("Authorization", `Bearer ${bob.accessToken}`).expect(200);
    expect(bobFriends.body.some((f: { username: string }) => f.username === alice.username)).toBe(true);

    const friendshipId = bobFriends.body.find((f: { username: string }) => f.username === alice.username).friendshipId;
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/${friendshipId}`)
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .expect(200);

    const aliceFriendsAfter = await request(app.getHttpServer())
      .get("/api/v1/friends")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(aliceFriendsAfter.body.some((f: { username: string }) => f.username === bob.username)).toBe(false);
  });

  it("rejects self-friending, duplicate requests, and a stranger accepting someone else's request", async () => {
    const carla = await registerUser(app, adminToken, "friendcarla");
    const dan = await registerUser(app, adminToken, "frienddan");
    const eve = await registerUser(app, adminToken, "friendeve");

    await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${carla.accessToken}`)
      .send({ username: carla.username })
      .expect(400);

    const req = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${carla.accessToken}`)
      .send({ username: dan.username })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${carla.accessToken}`)
      .send({ username: dan.username })
      .expect(409);
    // The reverse direction is blocked too, while the first request is still pending.
    await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${dan.accessToken}`)
      .send({ username: carla.username })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${req.body.id}/accept`)
      .set("Authorization", `Bearer ${eve.accessToken}`)
      .expect(403);
  });

  it("lets the addressee decline, and the requester cancel, a pending request", async () => {
    const finn = await registerUser(app, adminToken, "friendfinn");
    const gwen = await registerUser(app, adminToken, "friendgwen");

    const req1 = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${finn.accessToken}`)
      .send({ username: gwen.username })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/requests/${req1.body.id}`)
      .set("Authorization", `Bearer ${gwen.accessToken}`)
      .expect(200);

    // Declined — a fresh request between the same two players is possible again.
    const req2 = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${finn.accessToken}`)
      .send({ username: gwen.username })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/requests/${req2.body.id}`)
      .set("Authorization", `Bearer ${finn.accessToken}`)
      .expect(200);

    const gwenIncoming = await request(app.getHttpServer())
      .get("/api/v1/friends/requests?direction=incoming")
      .set("Authorization", `Bearer ${gwen.accessToken}`)
      .expect(200);
    expect(gwenIncoming.body.some((r: { user: { username: string } }) => r.user.username === finn.username)).toBe(false);
  });

  it("scopes the activity feed to friends-only when scope=friends is requested", async () => {
    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    const rarityId = rarities.body[0].id;
    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `friends-activity-series-${Date.now()}`, name: "Série amis", category: "ROLLING_STOCK" })
      .expect(201);
    async function createCard() {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          slug: `friends-activity-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          seriesId: series.body.id,
          name: "Carte amis",
          description: "…",
          category: "ROLLING_STOCK",
          rarityId,
          imageUrl: "/card-placeholders/common.svg",
          status: "PUBLISHED",
        })
        .expect(201);
      return res.body.id as string;
    }
    async function grant(userId: string, cardDefinitionId: string) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${userId}/grant-card`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ cardDefinitionId, quantity: 1 })
        .expect(201);
      return res.body.instanceIds[0] as string;
    }

    const viewer = await registerUser(app, adminToken, "friendviewer");
    const friend = await registerUser(app, adminToken, "friendseller");
    const stranger = await registerUser(app, adminToken, "friendstranger");

    // viewer <-> friend become friends; stranger stays unconnected.
    const req = await request(app.getHttpServer())
      .post("/api/v1/friends/requests")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ username: friend.username })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${req.body.id}/accept`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .expect(201);

    const buyer = await registerUser(app, adminToken, "friendbuyer");
    const friendCard = await createCard();
    const friendInstance = await grant(friend.user.id, friendCard);
    const friendListing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .send({ cardInstanceId: friendInstance, priceCr: 12 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${friendListing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    const strangerCard = await createCard();
    const strangerInstance = await grant(stranger.user.id, strangerCard);
    const strangerListing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ cardInstanceId: strangerInstance, priceCr: 12 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${strangerListing.body.id}/buy`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    const friendsFeed = await request(app.getHttpServer())
      .get("/api/v1/activity?limit=100&scope=friends")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(200);
    const sawFriendSale = friendsFeed.body.some(
      (e: { type: string; seller?: { username: string } }) => e.type === "MARKET_SALE" && e.seller?.username === friend.username,
    );
    const sawStrangerSale = friendsFeed.body.some(
      (e: { type: string; seller?: { username: string } }) => e.type === "MARKET_SALE" && e.seller?.username === stranger.username,
    );
    expect(sawFriendSale).toBe(true);
    expect(sawStrangerSale).toBe(false);

    // Without the scope, both sales are visible (the base feed is unchanged).
    const allFeed = await request(app.getHttpServer())
      .get("/api/v1/activity?limit=100")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(200);
    const sawStrangerInAll = allFeed.body.some(
      (e: { type: string; seller?: { username: string } }) => e.type === "MARKET_SALE" && e.seller?.username === stranger.username,
    );
    expect(sawStrangerInAll).toBe(true);
  });
});
