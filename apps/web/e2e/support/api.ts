import type { APIRequestContext } from "@playwright/test";

export const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:4000/api/v1";

const SEEDED_ADMIN_EMAIL = "admin@railcards.local";
const SEEDED_ADMIN_PASSWORD = "RailCards!Admin2026";

/**
 * Registration is invite-gated by product design, so a true end-to-end
 * "register a brand new player" run needs a fresh invitation code. Rather
 * than build that through the admin UI (which would make this suite about
 * the admin screens instead of the player golden path), we mint one
 * directly against the API with the seeded admin account — the same way a
 * real admin would generate a code out of band before sending it to a
 * tester.
 */
export async function mintInvitationCode(request: APIRequestContext): Promise<string> {
  const loginRes = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
  });
  if (!loginRes.ok()) {
    throw new Error(
      `Could not log in as the seeded admin (${loginRes.status()}) — is the API running and seeded? ` +
        `See README.md "Démarrage rapide".`,
    );
  }
  const { accessToken } = (await loginRes.json()) as { accessToken: string };

  const inviteRes = await request.post(`${API_BASE_URL}/admin/invitations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { maxUses: 1 },
  });
  if (!inviteRes.ok()) {
    throw new Error(`Could not mint an invitation code (${inviteRes.status()})`);
  }
  const { code } = (await inviteRes.json()) as { code: string };
  return code;
}

export function uniquePlayer(prefix: string) {
  const suffix = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10);
  return {
    email: `${prefix}-${suffix}@e2e.railcards.local`,
    username: `${prefix}${suffix}`.slice(0, 20),
    displayName: `E2E ${prefix}`,
    password: "Abcdef1234",
  };
}
