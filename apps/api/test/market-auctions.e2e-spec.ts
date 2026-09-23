import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createPrismaClient } from "@railcards/database";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Market auctions: bidding and settlement (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let rarityId: string;
  let seriesId: string;
  const prisma = createPrismaClient();

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    rarityId = rarities.body[0].id;

    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `auction-test-series-${Date.now()}`, name: "Série de test enchères", category: "ROLLING_STOCK" })
      .expect(201);
    seriesId = series.body.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createCard() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/cards")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `auction-test-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        seriesId,
        name: "Carte aux enchères",
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

  it("accepts an opening bid, refunds a bidder who gets outbid, and rejects a bid below the minimum", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctionseller");
    const bidderA = await registerUser(app, adminToken, "auctionbiddera");
    const bidderB = await registerUser(app, adminToken, "auctionbidderb");
    const instanceId = await grant(seller.user.id, cardId);

    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 50, listingType: "AUCTION", durationHours: 2 })
      .expect(201);
    expect(listing.body.listingType).toBe("AUCTION");
    expect(listing.body.currentBidCr).toBeNull();

    const aBefore = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${bidderA.accessToken}`).expect(200);

    // Below the starting price is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/bid`)
      .set("Authorization", `Bearer ${bidderA.accessToken}`)
      .send({ amountCr: 10 })
      .expect(400);

    const bid1 = await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/bid`)
      .set("Authorization", `Bearer ${bidderA.accessToken}`)
      .send({ amountCr: 50 })
      .expect(201);
    expect(bid1.body.currentBidCr).toBe(50);
    expect(bid1.body.currentBidder.username).toBe(bidderA.username);

    const aAfterFirstBid = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${bidderA.accessToken}`).expect(200);
    expect(aAfterFirstBid.body.walletBalance).toBe(aBefore.body.walletBalance - 50);

    // Equal to the current bid is rejected — must strictly exceed it.
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/bid`)
      .set("Authorization", `Bearer ${bidderB.accessToken}`)
      .send({ amountCr: 50 })
      .expect(400);

    const bid2 = await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/bid`)
      .set("Authorization", `Bearer ${bidderB.accessToken}`)
      .send({ amountCr: 80 })
      .expect(201);
    expect(bid2.body.currentBidCr).toBe(80);
    expect(bid2.body.currentBidder.username).toBe(bidderB.username);

    // Bidder A was outbid and got their 50 CR hold refunded in full.
    const aAfterOutbid = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${bidderA.accessToken}`).expect(200);
    expect(aAfterOutbid.body.walletBalance).toBe(aBefore.body.walletBalance);
  });

  it("rejects bidding on your own auction and bidding on a non-auction listing", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctionself");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/bid`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ amountCr: 10 })
      .expect(400);

    const cardId2 = await createCard();
    const instanceId2 = await grant(seller.user.id, cardId2);
    const fixedListing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId2, priceCr: 10 })
      .expect(201);
    const buyer = await registerUser(app, adminToken, "auctionfixedbuyer");
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${fixedListing.body.id}/bid`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .send({ amountCr: 20 })
      .expect(400);
  });

  it("refuses to cancel an auction once it has a bid", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctioncancelseller");
    const bidder = await registerUser(app, adminToken, "auctioncancelbidder");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/market/listings/${auction.body.id}`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(200);

    const auction2 = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction2.body.id}/bid`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amountCr: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/market/listings/${auction2.body.id}`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(409);
  });

  it("rejects settling an auction before its clock runs out", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctionearlysettle");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/settle`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(400);
  });

  it("settles a won auction by transferring the card and paying the seller (minus fee), with no extra debit to the winner", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctionwinseller");
    const winner = await registerUser(app, adminToken, "auctionwinwinner");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 100, listingType: "AUCTION" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/bid`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .send({ amountCr: 100 })
      .expect(201);

    const winnerBalanceAfterBid = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${winner.accessToken}`).expect(200)
    ).body.walletBalance;
    const sellerBalanceBefore = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${seller.accessToken}`).expect(200)
    ).body.walletBalance;

    // Time-travel: push the auction's end into the past so it's eligible to settle.
    await prisma.marketListing.update({ where: { id: auction.body.id }, data: { auctionEndsAt: new Date(Date.now() - 1000) } });

    const settled = await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/settle`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .expect(201);
    expect(settled.body.status).toBe("SOLD");

    const collectionRes = await request(app.getHttpServer())
      .get(`/api/v1/collection/${instanceId}`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .expect(200);
    expect(collectionRes.body.ownerId).toBe(winner.user.id);

    // The winner isn't debited again at settlement — only the 100 CR
    // already held from their bid moves.
    const winnerBalanceAfter = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${winner.accessToken}`).expect(200)
    ).body.walletBalance;
    expect(winnerBalanceAfter).toBe(winnerBalanceAfterBid);

    const sellerBalanceAfter = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${seller.accessToken}`).expect(200)
    ).body.walletBalance;
    expect(sellerBalanceAfter).toBeGreaterThan(sellerBalanceBefore);
    expect(sellerBalanceAfter).toBeLessThanOrEqual(sellerBalanceBefore + 100);

    // Settling again is a clean no-op error, not a crash.
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/settle`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .expect(409);
  });

  it("settles an auction with no bids by releasing the card back to AVAILABLE", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctionnobidsseller");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);

    await prisma.marketListing.update({ where: { id: auction.body.id }, data: { auctionEndsAt: new Date(Date.now() - 1000) } });

    const settled = await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/settle`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(201);
    expect(settled.body.status).toBe("CANCELLED");

    const collectionRes = await request(app.getHttpServer())
      .get(`/api/v1/collection/${instanceId}`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(200);
    expect(collectionRes.body.ownerId).toBe(seller.user.id);
    expect(collectionRes.body.state).toBe("AVAILABLE");
  });

  it("refuses to delete an account that's the leading bidder on a still-active auction", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctiondeleteguard");
    const bidder = await registerUser(app, adminToken, "auctiondeleteguardbidder");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/bid`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amountCr: 10 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${bidder.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);
  });

  it("lets an admin delete an account after its winning bid has already settled", async () => {
    const cardId = await createCard();
    const seller = await registerUser(app, adminToken, "auctiondeleteok");
    const winner = await registerUser(app, adminToken, "auctiondeleteokwinner");
    const instanceId = await grant(seller.user.id, cardId);

    const auction = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId, priceCr: 10, listingType: "AUCTION" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/bid`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .send({ amountCr: 10 })
      .expect(201);
    await prisma.marketListing.update({ where: { id: auction.body.id }, data: { auctionEndsAt: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${auction.body.id}/settle`)
      .set("Authorization", `Bearer ${winner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${winner.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
