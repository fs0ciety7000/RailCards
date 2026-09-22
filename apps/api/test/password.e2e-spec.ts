import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Password change & reset (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("changes the password when the current one is correct, and rejects a wrong current password", async () => {
    const { accessToken, email } = await registerUser(app, adminToken, "pwchangeuser");

    await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "WrongPassword1", newPassword: "NewPassword2" })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "Abcdef1234", newPassword: "NewPassword2" })
      .expect(201);

    // Old password no longer works; new one does.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "Abcdef1234" }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "NewPassword2" }).expect(201);
  });

  it("resets a password through the forgot-password flow, and revokes the reset link after use", async () => {
    const { email } = await registerUser(app, adminToken, "pwresetuser");

    const logSpy = jest.spyOn(Logger.prototype, "log");
    await request(app.getHttpServer()).post("/api/v1/auth/forgot-password").send({ email }).expect(201);

    const resetCall = logSpy.mock.calls.find((call) => String(call[0]).includes("Password reset requested"));
    expect(resetCall).toBeTruthy();
    const urlMatch = String(resetCall![0]).match(/token=([\w-]+)/);
    expect(urlMatch).toBeTruthy();
    const token = decodeURIComponent(urlMatch![1]);
    logSpy.mockRestore();

    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "ResetPassword3" })
      .expect(201);

    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "Abcdef1234" }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "ResetPassword3" }).expect(201);

    // Token is single-use.
    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "AnotherPassword4" })
      .expect(400);
  });

  it("silently succeeds for an unregistered email, and rejects an invalid reset token", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "definitely-not-a-user@railcards.local" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: "not-a-real-token", password: "SomePassword5" })
      .expect(400);
  });
});
