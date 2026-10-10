import * as net from "node:net";
import * as tls from "node:tls";
import { randomUUID } from "node:crypto";

/**
 * Minimal, dependency-free SMTP client for transactional mail.
 *
 * - port 465 → implicit TLS from the first byte;
 * - any other port (587, 25…) → plain connection upgraded with STARTTLS,
 *   which is **required**: credentials are never sent in clear text.
 * - authentication: AUTH PLAIN (or LOGIN if the server only offers that).
 */
export interface SmtpOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  /** Hostname announced in EHLO. */
  clientName?: string;
  timeoutMs?: number;
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

interface Reply {
  code: number;
  lines: string[];
}

class SmtpConnection {
  private buffer = "";
  private pendingLines: string[] = [];
  private waiter: { resolve: (r: Reply) => void; reject: (e: Error) => void } | null = null;
  private failure: Error | null = null;

  constructor(private socket: net.Socket) {
    this.attach(socket);
  }

  private attach(socket: net.Socket): void {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => this.onData(chunk));
    socket.on("error", (err) => this.fail(err));
    socket.on("close", () => this.fail(new Error("SMTP connection closed")));
  }

  private fail(err: Error): void {
    if (!this.failure) this.failure = err;
    if (this.waiter) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(err);
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "");
      this.buffer = this.buffer.slice(idx + 1);
      this.pendingLines.push(line);
      // Final line of a reply: "250 text" (a dash means more lines follow).
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply: Reply = { code: Number(line.slice(0, 3)), lines: this.pendingLines.map((l) => l.slice(4)) };
        this.pendingLines = [];
        if (this.waiter) {
          const { resolve } = this.waiter;
          this.waiter = null;
          resolve(reply);
        }
      }
    }
  }

  read(): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
  }

  /** `label` replaces the command in error messages (never echo credentials or the message body). */
  async command(line: string | null, expected: number[], label?: string): Promise<Reply> {
    const replyPromise = this.read();
    if (line !== null) this.socket.write(`${line}\r\n`);
    const reply = await replyPromise;
    if (!expected.includes(reply.code)) {
      const shown = label ?? line ?? "greeting";
      throw new Error(`SMTP ${shown} failed: ${reply.code} ${reply.lines.join(" ")}`);
    }
    return reply;
  }

  upgrade(host: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.removeAllListeners("data");
      this.socket.removeAllListeners("error");
      this.socket.removeAllListeners("close");
      const secure = tls.connect({ socket: this.socket, servername: host }, () => resolve());
      secure.setTimeout(timeoutMs, () => secure.destroy(new Error("SMTP timeout")));
      secure.once("error", reject);
      this.socket = secure;
      this.buffer = "";
      this.pendingLines = [];
      this.attach(secure);
    });
  }

  end(): void {
    this.socket.end();
  }
}

function encodeHeader(value: string): string {
  // RFC 2047 for non-ASCII header values (e.g. accented subjects).
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function extractAddress(mailbox: string): string {
  const match = mailbox.match(/<([^>]+)>/);
  return (match?.[1] ?? mailbox).trim();
}

function encodeMailbox(mailbox: string): string {
  const match = mailbox.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match || !match[1]) return extractAddress(mailbox);
  const name = match[1].replace(/^"|"$/g, "");
  return `${encodeHeader(name)} <${match[2]}>`;
}

export function buildMessage(message: MailMessage, date = new Date()): string {
  const fromAddress = extractAddress(message.from);
  const domain = fromAddress.split("@")[1] ?? "localhost";
  const body = Buffer.from(message.text.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n");
  return [
    `From: ${encodeMailbox(message.from)}`,
    `To: ${extractAddress(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

function connect(options: SmtpOptions, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket =
      options.port === 465
        ? tls.connect({ host: options.host, port: options.port, servername: options.host }, () => resolve(socket))
        : net.connect({ host: options.host, port: options.port }, () => resolve(socket));
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("SMTP timeout")));
    socket.once("error", reject);
  });
}

export async function sendMail(options: SmtpOptions, message: MailMessage): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const clientName = options.clientName ?? "localhost";
  const socket = await connect(options, timeoutMs);
  const conn = new SmtpConnection(socket);
  try {
    await conn.command(null, [220]);
    let ehlo = await conn.command(`EHLO ${clientName}`, [250]);

    if (options.port !== 465) {
      if (!ehlo.lines.some((l) => /^STARTTLS\b/i.test(l))) {
        throw new Error("SMTP server does not offer STARTTLS; refusing to send credentials in clear text");
      }
      await conn.command("STARTTLS", [220]);
      await conn.upgrade(options.host, timeoutMs);
      ehlo = await conn.command(`EHLO ${clientName}`, [250]);
    }

    if (options.user) {
      const authLine = ehlo.lines.find((l) => /^AUTH\b/i.test(l)) ?? "";
      const password = options.password ?? "";
      if (/\bPLAIN\b/i.test(authLine) || !/\bLOGIN\b/i.test(authLine)) {
        const token = Buffer.from(`\0${options.user}\0${password}`, "utf8").toString("base64");
        await conn.command(`AUTH PLAIN ${token}`, [235], "AUTH PLAIN");
      } else {
        await conn.command("AUTH LOGIN", [334]);
        await conn.command(Buffer.from(options.user, "utf8").toString("base64"), [334], "AUTH LOGIN (user)");
        await conn.command(Buffer.from(password, "utf8").toString("base64"), [235], "AUTH LOGIN (password)");
      }
    }

    await conn.command(`MAIL FROM:<${extractAddress(message.from)}>`, [250]);
    await conn.command(`RCPT TO:<${extractAddress(message.to)}>`, [250, 251]);
    await conn.command("DATA", [354]);
    const data = buildMessage(message).replace(/^\./gm, "..");
    await conn.command(`${data}\r\n.`, [250], "message body");
    await conn.command("QUIT", [221]).catch(() => undefined);
  } finally {
    conn.end();
  }
}
