import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Series completion (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;
  let commonRarityId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);

    const rarities = await request(app.getHttpServer())
      .get("/api/v1/rarities")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    commonRarityId = rarities.body.find((r: { code: string }) => r.code === "COMMON").id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTwoCardSeries() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const series = await request(app.getHttpServer())
      .post("/api/v1/admin/series")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: `series-completion-${suffix}`, name: "Série de Test", category: "DAILY_LIFE_HUMOR" })
      .expect(201);

    const cards = [];
    for (const name of ["Carte Un", "Carte Deux"]) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          slug: `series-completion-${suffix}-${name.toLowerCase().replace(/\s+/g, "-")}`,
          seriesId: series.body.id,
          name,
          description: "…",
          category: "DAILY_LIFE_HUMOR",
          rarityId: commonRarityId,
          imageUrl: "/card-placeholders/common.svg",
          status: "PUBLISHED",
        })
        .expect(201);
      cards.push(res.body);
    }
    return { seriesId: series.body.id as string, cards: cards as { id: string }[] };
  }

  async function createCompleteSeriesAchievement() {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/achievements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `complete-series-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: "Testeur de série",
        description: "…",
        goalType: "COMPLETE_SERIES",
        goalCount: 1,
        rewardCr: 42,
        rewardXp: 0,
      })
      .expect(201);
    return res.body.id as string;
  }

  it("only fires once all published cards in a series are owned, and only once", async () => {
    const { seriesId, cards } = await createTwoCardSeries();
    const achievementId = await createCompleteSeriesAchievement();
    const { accessToken, user } = await registerUser(app, adminToken, "seriesfan");

    async function grant(cardDefinitionId: string) {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${user.id}/grant-card`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ cardDefinitionId, quantity: 1 })
        .expect(201);
    }

    async function achievementProgress() {
      const res = await request(app.getHttpServer())
        .get("/api/v1/achievements")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      return res.body.find((a: { achievement: { id: string } }) => a.achievement.id === achievementId);
    }

    // Owning only one of the two cards must not complete the series.
    await grant(cards[0]!.id);
    let progress = await achievementProgress();
    expect(progress.progress).toBe(0);
    expect(progress.completedAt).toBeNull();

    // Owning both completes it exactly once.
    await grant(cards[1]!.id);
    progress = await achievementProgress();
    expect(progress.progress).toBe(1);
    expect(progress.completedAt).not.toBeNull();

    const album = await request(app.getHttpServer())
      .get("/api/v1/collection/album")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const albumEntry = album.body.find((s: { seriesId: string }) => s.seriesId === seriesId);
    expect(albumEntry.completionPct).toBe(100);

    // Claiming pays out the reward.
    const before = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/achievements/${achievementId}/claim`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const after = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(after.body.walletBalance).toBe(before.body.walletBalance + 42);

    // Granting more copies of an already-owned card must not double-count
    // the completion (idempotent via UserSeriesCompletion).
    await grant(cards[0]!.id);
    progress = await achievementProgress();
    expect(progress.progress).toBe(1);
  });
});
