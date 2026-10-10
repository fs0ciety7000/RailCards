import * as net from "node:net";
import { buildMessage, sendMail } from "./smtp-client";

describe("smtp-client", () => {
  it("builds a UTF-8 message with encoded headers", () => {
    const raw = buildMessage(
      {
        from: "RailCards <noreply@fs0ciety.org>",
        to: "joueur@example.org",
        subject: "Réinitialisation",
        text: "Bonjour\nlien",
      },
      new Date("2026-10-10T12:00:00Z"),
    );
    expect(raw).toContain("From: RailCards <noreply@fs0ciety.org>\r\n");
    expect(raw).toContain("To: joueur@example.org\r\n");
    expect(raw).toContain(`Subject: =?UTF-8?B?${Buffer.from("Réinitialisation").toString("base64")}?=\r\n`);
    expect(raw).toMatch(/Message-ID: <[\w-]+@fs0ciety\.org>/);
    const body = raw.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Bonjour\r\nlien");
  });

  it("refuses to authenticate when the server does not offer STARTTLS", async () => {
    const received: string[] = [];
    const server = net.createServer((socket) => {
      socket.write("220 fake ESMTP\r\n");
      socket.on("data", (chunk) => {
        const line = chunk.toString();
        received.push(line);
        if (line.startsWith("EHLO")) socket.write("250-fake\r\n250 AUTH PLAIN LOGIN\r\n");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as net.AddressInfo;
    try {
      await expect(
        sendMail(
          { host: "127.0.0.1", port, user: "u", password: "p", timeoutMs: 2000 },
          { from: "a@b.c", to: "d@e.f", subject: "s", text: "t" },
        ),
      ).rejects.toThrow(/STARTTLS/);
      expect(received.some((l) => l.startsWith("AUTH"))).toBe(false);
    } finally {
      server.close();
    }
  });
});
