import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Wanted-card alert: notified when a searched-for card is listed (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let cardDefinitionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const cards = await request(app.getHttpServer()).get("/api/v1/cards?pageSize=1").set("Authorization", `Bearer ${adminToken}`).expect(200);
    cardDefinitionId = cards.body.items[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("notifies an open wanted-listing poster when that exact card is listed on the market, but not the seller themselves", async () => {
    const wanter = await registerUser(app, adminToken, "wantedalertposter1");
    const seller = await registerUser(app, adminToken, "wantedalertseller1");

    await request(app.getHttpServer())
      .post("/api/v1/wanted")
      .set("Authorization", `Bearer ${wanter.accessToken}`)
      .send({ cardDefinitionId })
      .expect(201);

    const grant = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${seller.user.id}/grant-card`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cardDefinitionId, quantity: 2 })
      .expect(201);
    const [instanceId1, instanceId2] = grant.body.instanceIds as string[];

    await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId1, priceCr: 60 })
      .expect(201);

    const wanterNotifs = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=20")
      .set("Authorization", `Bearer ${wanter.accessToken}`)
      .expect(200);
    const alert = wanterNotifs.body.items.find((n: { type: string }) => n.type === "WANTED_CARD_LISTED");
    expect(alert).toBeTruthy();
    expect(alert.payload.cardDefinitionId).toBe(cardDefinitionId);
    expect(alert.payload.priceCr).toBe(60);

    // The seller doesn't get a self-notification about their own listing,
    // even though they also happen to already own (and are selling) it.
    const sellerNotifs = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=20")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(200);
    expect(sellerNotifs.body.items.some((n: { type: string }) => n.type === "WANTED_CARD_LISTED")).toBe(false);

    // Fulfilling (closing) the wanted listing means no further alerts.
    const mine = await request(app.getHttpServer()).get("/api/v1/wanted/mine").set("Authorization", `Bearer ${wanter.accessToken}`).expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/wanted/${mine.body[0].id}/cancel`)
      .set("Authorization", `Bearer ${wanter.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: instanceId2, priceCr: 65 })
      .expect(201);

    const wanterNotifsAfter = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=20")
      .set("Authorization", `Bearer ${wanter.accessToken}`)
      .expect(200);
    const alertsAfter = wanterNotifsAfter.body.items.filter((n: { type: string }) => n.type === "WANTED_CARD_LISTED");
    expect(alertsAfter).toHaveLength(1); // still just the one from before cancelling
  });
});
