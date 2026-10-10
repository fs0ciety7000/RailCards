import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type MailMessage, sendMail } from "./smtp-client";

const DEFAULT_FROM = "RailCards <noreply@fs0ciety.org>";

/**
 * Transactional mail over SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER /
 * SMTP_PASSWORD / EMAIL_FROM). Port 465 uses implicit TLS, any other port
 * STARTTLS. When SMTP_HOST is empty, mail is disabled and callers fall back
 * to logging (development).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>("SMTP_HOST"));
  }

  async send(message: Omit<MailMessage, "from">): Promise<void> {
    const host = this.config.get<string>("SMTP_HOST");
    if (!host) throw new Error("SMTP is not configured (SMTP_HOST is empty)");
    const apiBase = this.config.get<string>("API_BASE_URL") ?? "";
    let clientName = "localhost";
    try {
      clientName = new URL(apiBase).hostname || clientName;
    } catch {
      // keep default
    }
    await sendMail(
      {
        host,
        port: Number(this.config.get("SMTP_PORT") ?? 587),
        user: this.config.get<string>("SMTP_USER") || undefined,
        password: this.config.get<string>("SMTP_PASSWORD") || undefined,
        clientName,
      },
      { ...message, from: this.config.get<string>("EMAIL_FROM") || DEFAULT_FROM },
    );
    this.logger.log(`Mail "${message.subject}" sent`);
  }
}
