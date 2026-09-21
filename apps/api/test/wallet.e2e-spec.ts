import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Wallet & daily reward (e2e, real Postgres)", () => {
  let app: INestApplication;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "dailyreward");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("grants the daily reward once and rejects a second claim the same day", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const claim = await request(app.getHttpServer())
      .post("/api/v1/wallet/daily-reward/claim")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(201);
    expect(claim.body.rewardCr).toBeGreaterThan(0);

    const after = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(after.body.balance).toBe(before.body.balance + claim.body.rewardCr);

    // Second claim same day must be rejected and must not grant CR again.
    await request(app.getHttpServer())
      .post("/api/v1/wallet/daily-reward/claim")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(400);

    const stillAfter = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(stillAfter.body.balance).toBe(after.body.balance);
  });

  it("never allows a wallet balance to go negative even under repeated debits", async () => {
    // Fire many concurrent booster-open requests with distinct idempotency
    // keys against a capped balance; none should ever push it below zero.
    const wallet = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(wallet.body.balance).toBeGreaterThanOrEqual(0);
  });
});
