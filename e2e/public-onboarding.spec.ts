import { expect, test } from "@playwright/test";

test.describe("public onboarding", () => {
  test("routes the public homepage into the controlled onboarding flow", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Defend\.\s*Protect\.\s*Prevail\./i }),
    ).toBeVisible();

    const requestAccess = page.getByRole("link", { name: /Request Access/i }).first();
    await expect(requestAccess).toHaveAttribute("href", "/get-started");

    await requestAccess.click();
    await expect(page).toHaveURL(/\/get-started$/);
    await expect(
      page.getByRole("heading", { name: /Start with one controlled path into GEM Enterprise/i }),
    ).toBeVisible();
  });

  test("keeps eligibility and sign-in as explicit gated next steps", async ({ page }) => {
    await page.goto("/get-started");

    await expect(
      page.getByRole("link", { name: /Check Eligibility Status/i }).first(),
    ).toHaveAttribute("href", "/eligibility/status");

    await expect(
      page.getByRole("link", { name: /Client \/ Admin Sign In/i }).first(),
    ).toHaveAttribute("href", "/client-login");
  });
});
