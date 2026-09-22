import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Founders card auto-grant (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("grants the founders card to every new registration before the cutoff", async () => {
    // The cutoff is in the future for the foreseeable lifetime of this suite;
    // skip gracefully rather than fail once it eventually passes.
    if (new Date() >= new Date(GAME_CONSTANTS.FOUNDERS_CARD_CUTOFF_ISO)) return;

    const { accessToken } = await registerUser(app, adminToken, "founderuser");

    const collection = await request(app.getHttpServer())
      .get("/api/v1/collection?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const founderCard = collection.body.items.find(
      (i: { cardDefinition: { slug: string } }) => i.cardDefinition.slug === GAME_CONSTANTS.FOUNDERS_CARD_SLUG,
    );
    expect(founderCard).toBeTruthy();
    expect(founderCard.acquiredVia).toBe("FOUNDER_GRANT");

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications?pageSize=50")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(notifications.body.items.some((n: { type: string }) => n.type === "SYSTEM")).toBe(true);
  });
});
