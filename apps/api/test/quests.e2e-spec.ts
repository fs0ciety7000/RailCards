import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

async function openBooster(app: INestApplication, token: string, slug = "booster-decouverte") {
  const res = await request(app.getHttpServer())
    .post("/api/v1/boosters/open")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ boosterSlug: slug })
    .expect(201);
  return res.body.pulls.map((p: { cardInstanceId: string }) => p.cardInstanceId) as string[];
}

describe("Seasonal quests: narrative questline (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function questPayload(slug: string) {
    return {
      slug,
      title: "Le Grand Voyage",
      description: "Une aventure ferroviaire en plusieurs étapes.",
      steps: [
        { order: 1, title: "Premier départ", narrative: "Ouvrez votre tout premier booster.", goalType: "OPEN_BOOSTER", goalCount: 1, rewardCr: 50 },
        { order: 2, title: "Sur les rails du marché", narrative: "Achetez une carte sur le marché.", goalType: "BUY_ON_MARKET", goalCount: 1, rewardCr: 100, rewardXp: 20 },
      ],
    };
  }

  it("tracks progress through steps in order via the same action hooks as missions, and lets the player claim each reward", async () => {
    const player = await registerUser(app, adminToken, "questplayer1");
    const seller = await registerUser(app, adminToken, "questseller1");

    const quest = await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(questPayload(`grand-voyage-${Date.now()}`))
      .expect(201);
    expect(quest.body.status).toBe("ACTIVE");
    expect(quest.body.steps).toHaveLength(2);

    const initial = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(initial.body.id).toBe(quest.body.id);
    expect(initial.body.steps[0].completedAt).toBeNull();
    expect(initial.body.steps[0].progress).toBe(0);
    expect(initial.body.steps[1].completedAt).toBeNull();

    await openBooster(app, player.accessToken);

    const afterBooster = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const step1 = afterBooster.body.steps.find((s: { order: number }) => s.order === 1);
    const step2 = afterBooster.body.steps.find((s: { order: number }) => s.order === 2);
    expect(step1.completedAt).not.toBeNull();
    expect(step1.progress).toBe(1);
    expect(step2.completedAt).toBeNull();

    const walletBeforeClaim1 = (await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${player.accessToken}`)).body
      .balance as number;
    await request(app.getHttpServer())
      .post(`/api/v1/quests/steps/${step1.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);
    const walletAfterClaim1 = (await request(app.getHttpServer()).get("/api/v1/wallet").set("Authorization", `Bearer ${player.accessToken}`)).body
      .balance as number;
    expect(walletAfterClaim1).toBe(walletBeforeClaim1 + 50);

    // Re-claiming the same step is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/quests/steps/${step1.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(400);

    // Claiming a step with no progress recorded yet is rejected (no
    // UserQuestProgress row exists for it at all).
    await request(app.getHttpServer())
      .post(`/api/v1/quests/steps/${step2.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(404);

    // Drive the second step: seller lists a card, player buys it.
    const cards = await openBooster(app, seller.accessToken);
    const listing = await request(app.getHttpServer())
      .post("/api/v1/market/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ cardInstanceId: cards[0], priceCr: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/market/listings/${listing.body.id}/buy`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);

    const afterBuy = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    const step2After = afterBuy.body.steps.find((s: { order: number }) => s.order === 2);
    expect(step2After.completedAt).not.toBeNull();

    const meBefore = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/quests/steps/${step2After.id}/claim`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(201);
    const meAfter = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${player.accessToken}`).expect(200);
    expect(meAfter.body.xp).toBe(meBefore.body.xp + 20);

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=20")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(200);
    const types = notifications.body.items.map((n: { type: string }) => n.type);
    expect(types).toContain("QUEST_STEP_COMPLETED");
    expect(types).toContain("QUEST_COMPLETED");
  });

  it("archives the previous quest automatically when a new one is created ACTIVE, and lets an admin archive manually", async () => {
    const questA = await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(questPayload(`quest-a-${Date.now()}`))
      .expect(201);

    const activeAfterA = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(activeAfterA.body.id).toBe(questA.body.id);

    const questB = await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(questPayload(`quest-b-${Date.now()}`))
      .expect(201);

    const activeAfterB = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(activeAfterB.body.id).toBe(questB.body.id);

    const adminList = await request(app.getHttpServer()).get("/api/v1/admin/quests").set("Authorization", `Bearer ${adminToken}`).expect(200);
    const listedA = adminList.body.find((q: { id: string }) => q.id === questA.body.id);
    expect(listedA.status).toBe("ARCHIVED");

    await request(app.getHttpServer()).patch(`/api/v1/admin/quests/${questB.body.id}/archive`).set("Authorization", `Bearer ${adminToken}`).expect(200);

    const activeAfterArchive = await request(app.getHttpServer()).get("/api/v1/quests/active").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(activeAfterArchive.body).toBeNull();
  });

  it("rejects a quest with duplicate step order values", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `dup-order-${Date.now()}`,
        title: "Boucle dans le temps",
        description: "…",
        steps: [
          { order: 1, title: "Étape A", narrative: "…", goalType: "LOGIN", goalCount: 1 },
          { order: 1, title: "Étape B", narrative: "…", goalType: "LOGIN", goalCount: 1 },
        ],
      })
      .expect(409);
  });

  it("lets an admin delete a player's account that has quest progress on record", async () => {
    const player = await registerUser(app, adminToken, "questdeluser");
    await request(app.getHttpServer())
      .post("/api/v1/admin/quests")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(questPayload(`del-cleanup-${Date.now()}`))
      .expect(201);
    await openBooster(app, player.accessToken);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${player.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
