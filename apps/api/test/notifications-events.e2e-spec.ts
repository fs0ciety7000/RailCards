import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Notifications for game events (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function notificationTypes(accessToken: string): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return res.body.items.map((n: { type: string }) => n.type);
  }

  it("notifies MISSION_COMPLETED when a mission reward is claimed", async () => {
    const { accessToken } = await registerUser(app, adminToken, "notifmission");

    // Registering already counts as today's login for the daily-login mission.
    const missions = await request(app.getHttpServer())
      .get("/api/v1/missions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const loginMission = missions.body.find((m: { mission: { code: string } }) => m.mission.code === "daily-login");
    expect(loginMission.completedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/missions/${loginMission.userMissionId}/claim`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(await notificationTypes(accessToken)).toContain("MISSION_COMPLETED");
  });

  it("notifies CREDITS_EARNED when an admin credits a player's wallet", async () => {
    const { accessToken, user } = await registerUser(app, adminToken, "notifcredits");

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 100, reason: "Test bonus" })
      .expect(201);

    const types = await notificationTypes(accessToken);
    expect(types).toContain("CREDITS_EARNED");

    // A debit is not a "credits earned" event — no notification for it.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/wallet-adjustment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -50, reason: "Test debit" })
      .expect(201);
    const typesAfterDebit = await notificationTypes(accessToken);
    expect(typesAfterDebit.filter((t) => t === "CREDITS_EARNED")).toHaveLength(
      types.filter((t) => t === "CREDITS_EARNED").length,
    );
  });
});
