import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Admin: booster pool scoped by card category or series (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let commonRarityId: string;
  let vieDeQuaiSeriesId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer()).get("/api/v1/rarities").set("Authorization", `Bearer ${adminToken}`).expect(200);
    commonRarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;

    const series = await request(app.getHttpServer())
      .get("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    vieDeQuaiSeriesId = series.body.find((s: { slug: string }) => s.slug === "vie-de-quai").id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createBooster() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/boosters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `pool-scope-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: "Booster de test scoping",
        description: "…",
        category: "THEMED",
        priceCr: 1,
        cardCount: 3,
        imageUrl: "/booster-placeholders/discovery.svg",
      })
      .expect(201);
    return res.body as { id: string; slug: string };
  }

  async function openAndCollectSlugs(userToken: string, boosterSlug: string, times: number): Promise<string[]> {
    const slugs: string[] = [];
    for (let i = 0; i < times; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/boosters/open")
        .set("Authorization", `Bearer ${userToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ boosterSlug })
        .expect(201);
      for (const pull of res.body.pulls) slugs.push(pull.cardDefinition.slug);
    }
    return slugs;
  }

  it("restricts draws to the entry's card category", async () => {
    const booster = await createBooster();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/boosters/${booster.id}/pool`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ entries: [{ rarityId: commonRarityId, weight: 1, category: "DAILY_LIFE_HUMOR" }] })
      .expect(201);

    const { accessToken } = await registerUser(app, adminToken, "poolcatuser");
    const slugs = await openAndCollectSlugs(accessToken, booster.slug, 4);
    expect(slugs.length).toBeGreaterThan(0);

    for (const slug of slugs) {
      const card = await request(app.getHttpServer())
        .get(`/api/v1/admin/cards?pageSize=500`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const def = card.body.items.find((c: { slug: string }) => c.slug === slug);
      expect(def.category).toBe("DAILY_LIFE_HUMOR");
      expect(def.rarity.code).toBe("COMMON");
    }
  });

  it("restricts draws to the entry's series", async () => {
    const booster = await createBooster();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/boosters/${booster.id}/pool`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ entries: [{ rarityId: commonRarityId, weight: 1, seriesId: vieDeQuaiSeriesId }] })
      .expect(201);

    const { accessToken } = await registerUser(app, adminToken, "poolseriesuser");
    const slugs = await openAndCollectSlugs(accessToken, booster.slug, 4);
    expect(slugs.length).toBeGreaterThan(0);

    const cards = await request(app.getHttpServer())
      .get(`/api/v1/admin/cards?pageSize=500`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    for (const slug of slugs) {
      const def = cards.body.items.find((c: { slug: string }) => c.slug === slug);
      expect(def.series.id).toBe(vieDeQuaiSeriesId);
    }
  });

  it("combining an incompatible category and series yields no eligible cards (opening fails)", async () => {
    const booster = await createBooster();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/boosters/${booster.id}/pool`)
      .set("Authorization", `Bearer ${adminToken}`)
      // "vie-de-quai" is DAILY_LIFE_HUMOR, not SPECIAL_EDITION — the AND of both filters is empty.
      .send({ entries: [{ rarityId: commonRarityId, weight: 1, category: "SPECIAL_EDITION", seriesId: vieDeQuaiSeriesId }] })
      .expect(201);

    const { accessToken } = await registerUser(app, adminToken, "poolemptyuser");
    await request(app.getHttpServer())
      .post("/api/v1/boosters/open")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ boosterSlug: booster.slug })
      .expect(400);
  });
});
