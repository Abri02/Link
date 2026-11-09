import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueUser } from "./helpers";

const html = (page: Page) => page.locator("html");
const canvas = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--link-canvas").trim());

test("defaults to paper with no saved theme", async ({ page }) => {
  await page.goto("/login");
  await expect(html(page)).toHaveAttribute("data-theme", "paper");
  await expect(html(page)).toHaveClass("light");
  await expect(page.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
});

test("picked theme applies at once and survives a reload", async ({ page }) => {
  await page.goto("/login");
  const before = await canvas(page);

  await page.getByRole("button", { name: "Forest" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "forest");
  await expect(html(page)).toHaveClass(/\bdark\b/);
  expect(await canvas(page)).not.toBe(before);

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "forest");
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("button", { name: "Forest" })).toHaveAttribute("aria-pressed", "true");
});

test("saved theme is on <html> before the app bundle runs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("link-theme", "harbor"));
  // Without the module script only the inline <head> script can have set the theme.
  await page.route("**/src/main.tsx*", (route) => route.abort());
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(html(page)).toHaveAttribute("data-theme", "harbor");
});

for (const invalid of ["neon", "constructor"]) {
  test(`invalid stored value "${invalid}" falls back to paper`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("link-theme", value), invalid);
    await page.goto("/login");
    await expect(html(page)).toHaveAttribute("data-theme", "paper");
    await expect(page.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
  });
}

test("each swatch shows its own theme's accent", async ({ page }) => {
  await page.goto("/login");
  const swatches = page.getByRole("group", { name: "Theme" }).getByRole("button");
  await expect(swatches).toHaveCount(4);
  const colours = await swatches.evaluateAll((buttons) => buttons.map((b) => getComputedStyle(b).backgroundColor));
  expect(new Set(colours).size).toBe(4);
});

test("theme can be changed from the workspace sidebar", async ({ page }) => {
  const { email, username } = uniqueUser("theme");
  await signUp(page, email, username);

  await page.getByRole("button", { name: "Graphite" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "graphite");

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "graphite");
});
