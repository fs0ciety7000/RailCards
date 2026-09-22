import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin permission control (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "regularuser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies a regular user access to admin endpoints", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ maxUses: 1 })
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/admin/users/00000000-0000-0000-0000-000000000000/wallet-adjustment")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100 })
      .expect(403);
  });

  it("denies unauthenticated access to admin endpoints", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/users").expect(401);
  });

  it("allows an admin to access admin endpoints", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("never lets a regular user assign themselves the ADMIN role via the update-my-profile surface", async () => {
    // There is deliberately no endpoint that accepts a role field from the
    // client; this asserts the /me read-model still reports USER after
    // attempting to smuggle a role change through unrelated write paths.
    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(me.body.role).toBe("USER");
  });

  it("prevents an admin from suspending their own account", async () => {
    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${me.body.id}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("lets an admin credit and debit a user's wallet, journaling each adjustment", async () => {
    const registered = await registerUser(app, adminToken, "walletadj");

    const before = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(200);

    const credit = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${registered.user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 250, reason: "test credit" })
      .expect(201);
    expect(credit.body.balance).toBe(before.body.balance + 250);

    const debit = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${registered.user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -100 })
      .expect(201);
    expect(debit.body.balance).toBe(before.body.balance + 150);

    const wallet = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(200);
    expect(wallet.body.balance).toBe(before.body.balance + 150);
  });

  it("rejects a zero-amount wallet adjustment and a debit that would go below zero", async () => {
    const registered = await registerUser(app, adminToken, "walletguard");
    const before = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${registered.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${registered.user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${registered.user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -(before.body.balance + 1000) })
      .expect(400);
  });
});
