import { test, expect } from "@playwright/test";
import { mintInvitationCode, uniquePlayer } from "./support/api";

/**
 * The MVP's required golden path: inscription → booster de bienvenue →
 * découverte → album → marché/échange. Runs against the real API and a
 * real (seeded) PostgreSQL database — no mocking. See
 * docs/architecture/testing.md for how this fits with the Jest
 * integration suite that covers the same path's server-side invariants.
 */
test.describe("Golden path: register → welcome bonus → booster → collection → market listing", () => {
  test("a brand new player can complete the full loop", async ({ page, request }) => {
    const invitationCode = await mintInvitationCode(request);
    const player = uniquePlayer("golden");

    // 1. Inscription (sur invitation)
    await page.goto("/register");
    await page.getByLabel("Email").fill(player.email);
    await page.getByLabel("Nom d'utilisateur").fill(player.username);
    await page.getByLabel("Nom affiché").fill(player.displayName);
    await page.getByLabel("Mot de passe").fill(player.password);
    await page.getByLabel("Code d'invitation").fill(invitationCode);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // 2. Onboarding — bonus de bienvenue
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Bienvenue à bord !" })).toBeVisible();
    await expect(page.getByText(/500\s*CR/)).toBeVisible();

    // 3. Ouverture d'un booster (découverte)
    await page.getByRole("button", { name: "Ouvrir mon premier booster" }).click();
    await expect(page).toHaveURL(/\/boosters$/);
    await page.getByRole("button", { name: "Ouvrir", exact: true }).first().click();

    // The reveal animation renders the pulled cards; give it a moment then
    // confirm the post-opening actions are available regardless of the
    // animation's own internal state (it always renders "Voir ma
    // collection" once the booster has actually been opened server-side).
    const viewCollectionLink = page.getByRole("link", { name: "Voir ma collection" });
    await expect(viewCollectionLink).toBeVisible({ timeout: 15_000 });

    // 4. Album / collection — les cartes tirées doivent être visibles
    await viewCollectionLink.click();
    await expect(page).toHaveURL(/\/collection$/);
    await expect(page.getByText(/Aucune carte/i)).toHaveCount(0);

    // 5. Mise en vente sur le marché d'une carte obtenue
    const firstCard = page.locator('a[href^="/collection/"]:not([href="/collection/album"])').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/collection\/[0-9a-f-]+$/);

    const sellLink = page.getByRole("link", { name: "Mettre en vente" });
    await expect(sellLink).toBeVisible();
    await sellLink.click();
    await expect(page).toHaveURL(/\/market\/new/);
    await page.getByLabel("Prix (CR)").fill("10");
    await page.getByRole("button", { name: /Publier l.annonce/ }).click();
    await expect(page).toHaveURL(/\/market\/[0-9a-f-]+$/);
    await expect(page.getByText(/10\s*CR/)).toBeVisible();
  });
});
