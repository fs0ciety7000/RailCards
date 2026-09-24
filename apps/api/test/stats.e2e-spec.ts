import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Personal stats (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("shows 0s for a fresh registration beyond the welcome bonus, then reflects booster spend, pulls, and active days", async () => {
    const player = await registerUser(app, adminToken, "statsplayer");

    // A fresh registration already recorded a WELCOME_BONUS credit, so
    // creditsEarned starts above zero, but nothing has been spent or
    // pulled yet.
    const before = await request(app.getHttpServer()).get("/api/v1/stats/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(before.body.creditsEarned).toBeGreaterThan(0);
    expect(before.body.creditsSpent).toBe(0);
    expect(before.body.totalBoostersOpened).toBe(0);
    expect(before.body.totalCardsPulled).toBe(0);
    expect(before.body.topPulledCards).toEqual([]);
    expect(before.body.activeDays).toBeGreaterThanOrEqual(1);

    const opened = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);
    const pullCount = opened.body.pulls.length as number;
    expect(pullCount).toBeGreaterThan(0);

    const after = await request(app.getHttpServer()).get("/api/v1/stats/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(after.body.creditsSpent).toBeGreaterThan(0);
    expect(after.body.totalBoostersOpened).toBe(1);
    expect(after.body.totalCardsPulled).toBe(pullCount);

    // Every pulled card is accounted for exactly once across the top list.
    const totalFromTopList = after.body.topPulledCards.reduce((sum: number, c: { pullCount: number }) => sum + c.pullCount, 0);
    expect(totalFromTopList).toBe(pullCount);
    for (const card of after.body.topPulledCards) {
      expect(card.name).toEqual(expect.any(String));
      expect(card.rarity.code).toEqual(expect.any(String));
    }
    // Sorted descending by pull count.
    const counts = after.body.topPulledCards.map((c: { pullCount: number }) => c.pullCount);
    expect([...counts].sort((a: number, b: number) => b - a)).toEqual(counts);
  });
});
