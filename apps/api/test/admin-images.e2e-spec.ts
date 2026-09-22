import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin } from "./utils/fixtures";

describe("Admin: series and booster image fields (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets a series cover image on create and can change it on update", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `cover-series-${Date.now()}`,
        name: "Série avec couverture",
        category: "ROLLING_STOCK",
        coverImageUrl: "/card-placeholders/rare.svg",
      })
      .expect(201);
    expect(created.body.coverImageUrl).toBe("/card-placeholders/rare.svg");

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/series/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ coverImageUrl: "/card-placeholders/epic.svg" })
      .expect(200);
    expect(updated.body.coverImageUrl).toBe("/card-placeholders/epic.svg");

    const album = await request(app.getHttpServer())
      .get("/api/v1/collection/album")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const albumEntry = album.body.find((s: { seriesId: string }) => s.seriesId === created.body.id);
    expect(albumEntry.coverImageUrl).toBe("/card-placeholders/epic.svg");
  });

  it("creates a booster and updates its name, price, and image afterward", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/boosters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `update-test-booster-${Date.now()}`,
        name: "Booster à modifier",
        description: "…",
        category: "DISCOVERY",
        priceCr: 50,
        cardCount: 3,
        imageUrl: "/booster-placeholders/discovery.svg",
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/boosters/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Booster modifié", priceCr: 99, imageUrl: "/booster-placeholders/classic.svg", isActive: false })
      .expect(200);
    expect(updated.body.name).toBe("Booster modifié");
    expect(updated.body.priceCr).toBe(99);
    expect(updated.body.imageUrl).toBe("/booster-placeholders/classic.svg");
    expect(updated.body.isActive).toBe(false);

    const listed = await request(app.getHttpServer())
      .get("/api/v1/admin/boosters")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const listedBooster = listed.body.find((b: { id: string }) => b.id === created.body.id);
    expect(listedBooster.name).toBe("Booster modifié");
  });
});
