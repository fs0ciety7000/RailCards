import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Free booster (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("is not listed in the shop and can't be opened via the paid endpoint", async () => {
    const { accessToken } = await registerUser(app, adminToken, "freeboosterbypass");

    const shop = await request(app.getHttpServer())
      .get("/api/v1/boosters")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(shop.body.some((b: { slug: string }) => b.slug === "booster-gratuit")).toBe(false);

    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-gratuit" })
      .expect(404);
  });

  it("grants 2 cards for free, then enforces a 4h cooldown before the next claim", async () => {
    const { accessToken } = await registerUser(app, adminToken, "freeboosteruser");

    const before = await request(app.getHttpServer())
      .get("/api/v1/boosters/free/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body).toEqual({ claimable: true, nextAvailableAt: null });

    const claim = await request(app.getHttpServer())
      .post("/api/v1/boosters/free/claim")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(claim.body.pulls).toHaveLength(2);
    expect(claim.body.pricePaidCr).toBe(0);

    const after = await request(app.getHttpServer())
      .get("/api/v1/boosters/free/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.claimable).toBe(false);
    const nextAvailableAt = new Date(after.body.nextAvailableAt);
    const hoursUntilNext = (nextAvailableAt.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursUntilNext).toBeGreaterThan(3.9);
    expect(hoursUntilNext).toBeLessThanOrEqual(4);

    await request(app.getHttpServer())
      .post("/api/v1/boosters/free/claim")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });
});
