import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { uniqueEmail, uniqueUsername } from "./test-app";

export const SEEDED_ADMIN_EMAIL = "admin@railcards.local";
export const SEEDED_ADMIN_PASSWORD = "RailCards!Admin2026";

export async function loginAdmin(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD })
    .expect(201);
  return res.body.accessToken as string;
}

export async function createInvitation(app: INestApplication, adminToken: string, maxUses = 1) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/admin/invitations")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ maxUses })
    .expect(201);
  return res.body.code as string;
}

export async function registerUser(app: INestApplication, adminToken: string, usernamePrefix = "player") {
  const invitationCode = await createInvitation(app, adminToken, 1);
  const email = uniqueEmail(usernamePrefix);
  const username = uniqueUsername(usernamePrefix);
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({
      email,
      username,
      displayName: `Test ${usernamePrefix}`,
      password: "Abcdef1234",
      invitationCode,
    })
    .expect(201);
  return { accessToken: res.body.accessToken as string, user: res.body.user, email, username };
}
