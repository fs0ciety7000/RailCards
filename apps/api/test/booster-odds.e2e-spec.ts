import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Booster odds (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "boosteroddsuser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a per-rarity breakdown for a real booster that sums to 100%", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/boosters/booster-decouverte/odds")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.cardCount).toBeGreaterThan(0);
    expect(Array.isArray(res.body.rarities)).toBe(true);
    expect(res.body.rarities.length).toBeGreaterThan(0);

    let total = 0;
    for (const r of res.body.rarities) {
      expect(r).toEqual(
        expect.objectContaining({
          rarityId: expect.any(String),
          rarityCode: expect.any(String),
          rarityLabel: expect.any(String),
          colorHex: expect.any(String),
          eligibleCardCount: expect.any(Number),
        }),
      );
      expect(r.probability).toBeGreaterThan(0);
      expect(r.eligibleCardCount).toBeGreaterThan(0);
      total += r.probability;
    }
    expect(total).toBeCloseTo(1, 5);
  });

  it("orders rarities from highest to lowest tier", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/boosters/booster-decouverte/odds")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const orders = res.body.rarities.map((r: { rarityCode: string }) => r.rarityCode);
    // Whatever the exact tiers, the response itself must be internally
    // consistent with a real /rarities lookup — descending order value.
    const rarities = await request(app.getHttpServer())
      .get("/api/v1/rarities")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    const orderByCode = new Map(rarities.body.map((r: { code: string; order: number }) => [r.code, r.order]));
    const values = orders.map((code: string) => orderByCode.get(code) as number);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("404s for an unknown booster slug", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/boosters/not-a-real-booster/odds")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(404);
  });

  it("still returns odds for the free booster (excluded from the shop listing, but still a real active definition)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/boosters/booster-gratuit/odds")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
  });
});
