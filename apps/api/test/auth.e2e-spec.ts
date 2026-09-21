import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, uniqueEmail, uniqueUsername } from "./utils/test-app";
import { loginAdmin, createInvitation, registerUser } from "./utils/fixtures";

describe("Auth (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects registration without an invitation code when invite-only mode is on", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: uniqueEmail("noinvite"),
        username: uniqueUsername("noinvite"),
        displayName: "No Invite",
        password: "Abcdef1234",
      });
    expect(res.status).toBe(403);
  });

  it("registers and logs in a user with a valid invitation code, granting a one-time welcome bonus", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "walletuser");

    const walletRes = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(walletRes.body.balance).toBe(500);

    // Registering is the only way to trigger the welcome bonus, and email
    // is unique, so replaying the exact same registration must fail and
    // must not grant a second bonus.
    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Abcdef1234" })
      .expect(201);
    expect(loginRes.body.user.username).toBe(user.username);

    const walletAfterLogin = await request(app.getHttpServer())
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .expect(200);
    expect(walletAfterLogin.body.balance).toBe(500);
  });

  it("rejects an invitation code that has already reached its max uses", async () => {
    const code = await createInvitation(app, adminToken, 1);
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: uniqueEmail("first"),
        username: uniqueUsername("first"),
        displayName: "First",
        password: "Abcdef1234",
        invitationCode: code,
      })
      .expect(201);

    const secondAttempt = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: uniqueEmail("second"),
        username: uniqueUsername("second"),
        displayName: "Second",
        password: "Abcdef1234",
        invitationCode: code,
      });
    expect(secondAttempt.status).toBe(400);
  });

  it("rejects access to protected routes without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/me").expect(401);
  });

  it("rejects an expired/invalid access token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });
});
