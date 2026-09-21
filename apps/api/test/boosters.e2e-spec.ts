import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Boosters (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "boosteruser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires an Idempotency-Key header", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ boosterSlug: "booster-decouverte" })
      .expect(400);
  });

  it("opens a booster, debits the wallet, and grants cards visible in the collection", async () => {
    const key = randomUUID();
    const before = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const openRes = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", key)
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);

    expect(openRes.body.pulls).toHaveLength(3);
    for (const pull of openRes.body.pulls) {
      expect(pull.cardInstanceId).toBeTruthy();
      expect(pull.cardDefinition.status).toBe("PUBLISHED");
    }

    const after = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(after.body.balance).toBe(before.body.balance - 80);

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(collection.body.total).toBeGreaterThanOrEqual(3);
  });

  it("is idempotent: repeating the same Idempotency-Key never double-charges or redraws", async () => {
    const key = randomUUID();
    const first = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", key)
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);

    const before = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", key)
      .send({ boosterSlug: "booster-decouverte" })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.pulls.map((p: { cardInstanceId: string }) => p.cardInstanceId)).toEqual(
      first.body.pulls.map((p: { cardInstanceId: string }) => p.cardInstanceId),
    );

    const after = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(after.body.balance).toBe(before.body.balance); // no second debit
  });

  it("rejects opening a booster once the balance is insufficient, and balance never goes negative", async () => {
    // Drain the wallet with classic boosters (120 CR each) until it can't afford another.
    let lastStatus = 201;
    let balance = (
      await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${userToken}`)
    ).body.balance as number;

    while (balance >= 120 && lastStatus === 201) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/boosters/open")
        .set("Authorization", `Bearer ${userToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ boosterSlug: "booster-classique" });
      lastStatus = res.status;
      if (lastStatus === 201) balance -= 120;
    }

    const failing = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-classique" });
    expect(failing.status).toBe(400);

    const wallet = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(wallet.body.balance).toBeGreaterThanOrEqual(0);
  });

  it("ignores any client-supplied fields attempting to influence the draw or price", async () => {
    // extra unknown fields must be rejected by the whitelist ValidationPipe
    const res = await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: "booster-decouverte", forcedRarity: "MYTHIC", priceCr: 0 });
    expect(res.status).toBe(400);
  });
});
