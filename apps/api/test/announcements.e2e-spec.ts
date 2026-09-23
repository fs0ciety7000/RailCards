import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Site announcement banner (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("publishes, updates, and unpublishes a single site-wide announcement", async () => {
    const player = await registerUser(app, adminToken, "announceplayer1");

    const published = await request(app.getHttpServer())
      .post("/api/v1/admin/announcement")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ message: "Maintenance ce soir à 22h.", isActive: true })
      .expect(201);
    expect(published.body.isActive).toBe(true);

    const active1 = await request(app.getHttpServer()).get("/api/v1/announcement/active").expect(200);
    expect(active1.body.message).toBe("Maintenance ce soir à 22h.");

    // Editing the message keeps it published.
    const edited = await request(app.getHttpServer())
      .post("/api/v1/admin/announcement")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ message: "Maintenance reportée à minuit.", isActive: true })
      .expect(201);
    expect(edited.body.id).toBe(published.body.id);

    const active2 = await request(app.getHttpServer()).get("/api/v1/announcement/active").expect(200);
    expect(active2.body.message).toBe("Maintenance reportée à minuit.");

    // Unpublishing hides it from the public endpoint but keeps it editable for admins.
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcement")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ message: "Maintenance reportée à minuit.", isActive: false })
      .expect(201);

    const activeAfterUnpublish = await request(app.getHttpServer()).get("/api/v1/announcement/active").expect(200);
    expect(activeAfterUnpublish.body).toBeNull();

    const adminView = await request(app.getHttpServer()).get("/api/v1/admin/announcement").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(adminView.body.message).toBe("Maintenance reportée à minuit.");
    expect(adminView.body.isActive).toBe(false);

    // A regular player can't manage it.
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcement")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ message: "hijack", isActive: true })
      .expect(403);
  });
});
