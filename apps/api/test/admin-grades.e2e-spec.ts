import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin: grades (profile ranks) CRUD (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
    const registered = await registerUser(app, adminToken, "gradeuser");
    userToken = registered.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies a regular user access to grade admin endpoints", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/grades").set("Authorization", `Bearer ${userToken}`).expect(403);
  });

  it("lets an admin add a new rank, which then appears on a player's profile at that level", async () => {
    // Use a very high minLevel so it doesn't collide with the seeded ladder
    // or with the fresh test user's level 1.
    const minLevel = 500 + Math.floor(Math.random() * 400);
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/grades")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minLevel, title: "Titre de test" })
      .expect(201);
    expect(create.body.minLevel).toBe(minLevel);

    // The new rank must show up in the live ladder immediately (cache refresh).
    const list = await request(app.getHttpServer()).get("/api/v1/admin/grades").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(list.body.some((g: { id: string }) => g.id === create.body.id)).toBe(true);

    const update = await request(app.getHttpServer())
      .patch(`/api/v1/admin/grades/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Titre de test (modifié)" })
      .expect(200);
    expect(update.body.title).toBe("Titre de test (modifié)");
  });

  it("rejects creating two ranks with the same minLevel", async () => {
    const minLevel = 900 + Math.floor(Math.random() * 90);
    await request(app.getHttpServer())
      .post("/api/v1/admin/grades")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minLevel, title: "Premier" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/admin/grades")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minLevel, title: "Doublon" })
      .expect(409);
  });

  it("refuses to delete the last remaining rank, but allows deleting one of several", async () => {
    const minLevel = 700 + Math.floor(Math.random() * 90);
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/grades")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minLevel, title: "À supprimer" })
      .expect(201);

    // There are always the seeded ranks plus this one, so deletion succeeds.
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/grades/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const list = await request(app.getHttpServer()).get("/api/v1/admin/grades").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(list.body.some((g: { id: string }) => g.id === created.body.id)).toBe(false);
  });

  it("renaming the base (level 1) rank changes what a fresh player sees as their grade, live (no restart)", async () => {
    // Other specs (e.g. missions.e2e-spec.ts) assert the exact seeded title
    // for a level-1 player, so this test must restore it no matter what —
    // hence try/finally rather than a trailing restore call.
    const base = (await request(app.getHttpServer()).get("/api/v1/admin/grades").set("Authorization", `Bearer ${adminToken}`).expect(200)).body.find(
      (g: { minLevel: number }) => g.minLevel === 1,
    );
    expect(base).toBeTruthy();
    const originalTitle = base.title;
    const renamedTitle = `Rang renommé ${randomUUID().slice(0, 8)}`;

    try {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/grades/${base.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: renamedTitle })
        .expect(200);

      const { accessToken } = await registerUser(app, adminToken, "gradecheckuser");
      const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
      expect(me.body.grade).toBe(renamedTitle);
    } finally {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/grades/${base.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: originalTitle })
        .expect(200);
    }
  });
});
