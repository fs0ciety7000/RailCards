import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { loginAdmin, registerUser } from "./utils/fixtures";

describe("Guild chat (e2e, real Postgres)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueTag(prefix: string) {
    return `${prefix}${Math.random().toString(36).slice(2, 4)}`.toUpperCase().slice(0, 5);
  }

  it("lets members post and read messages in order, and rejects non-members", async () => {
    const leader = await registerUser(app, adminToken, "chatleader1");
    const member = await registerUser(app, adminToken, "chatmember1");
    const outsider = await registerUser(app, adminToken, "chatoutsider1");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Salon Discussion ${Date.now()}`, tag: uniqueTag("CH") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ body: "Bienvenue dans la guilde !" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "Merci, content d'être là." })
      .expect(201);

    const messages = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(2);
    expect(messages.body[0].body).toBe("Bienvenue dans la guilde !");
    expect(messages.body[0].author.username).toBe(leader.username);
    expect(messages.body[1].body).toBe("Merci, content d'être là.");

    // Someone outside the guild can't read or post.
    await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .send({ body: "je m'incruste" })
      .expect(403);
  });

  it("keeps a message visible in history after its author leaves the guild", async () => {
    const leader = await registerUser(app, adminToken, "chatleader2");
    const member = await registerUser(app, adminToken, "chatmember2");

    const guild = await request(app.getHttpServer())
      .post("/api/v1/guilds")
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .send({ name: `Salon Ephemere ${Date.now()}`, tag: uniqueTag("EP") })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "Je passais juste dire bonjour." })
      .expect(201);

    await request(app.getHttpServer()).post("/api/v1/guilds/leave").set("Authorization", `Bearer ${member.accessToken}`).expect(201);

    // The leader (still a member) can still read the departed member's message.
    const messages = await request(app.getHttpServer())
      .get(`/api/v1/guilds/${guild.body.id}/messages`)
      .set("Authorization", `Bearer ${leader.accessToken}`)
      .expect(200);
    expect(messages.body.some((m: { body: string }) => m.body === "Je passais juste dire bonjour.")).toBe(true);
  });
});
