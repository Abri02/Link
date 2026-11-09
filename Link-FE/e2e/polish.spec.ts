import { expect, test, type Page } from "@playwright/test";
import { createWorkspace, selectChannel, selectWorkspace, sendMessage, signUp, uniqueUser } from "./helpers";

async function openGeneral(page: Page, tag: string) {
  const user = uniqueUser(tag);
  await signUp(page, user.email, user.username);
  const workspace = `${tag}-${Date.now()}`;
  await createWorkspace(page, workspace);
  await selectWorkspace(page, workspace);
  await selectChannel(page, "general");
  await expect(page.getByPlaceholder("Message #general")).toBeVisible();
}

test("a new user is told to create a workspace", async ({ page }) => {
  const user = uniqueUser("polishnew");
  await signUp(page, user.email, user.username);
  await expect(page.getByText("Create a workspace to get started").first()).toBeVisible();
});

test("a search with no hits says so instead of inviting a first message", async ({ page }) => {
  await openGeneral(page, "polishsearch");
  await sendMessage(page, "general", "something findable");
  await expect(page.getByText("something findable")).toBeVisible();

  await page.getByPlaceholder("Search messages…").fill("zzz-no-such-text");
  await expect(page.getByText("No messages match your search")).toBeVisible();
  await expect(page.getByText("Be the first to say something")).toBeHidden();
});

test("phone width shows one pane at a time and fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openGeneral(page, "polishphone");

  const composer = page.getByPlaceholder("Message #general");
  const channel = page.getByRole("button", { name: "general" });
  const send = await page.getByRole("button", { name: "Send message" }).boundingBox();
  expect(send!.x + send!.width).toBeLessThanOrEqual(375);
  await expect(channel).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole("button", { name: "Back to channels" }).click();
  await expect(channel).toBeVisible();
  await expect(composer).toBeHidden();
});

test("desktop width keeps the sidebars and the conversation side by side", async ({ page }) => {
  await openGeneral(page, "polishdesk");
  await expect(page.getByRole("button", { name: "general" })).toBeVisible();
  await expect(page.getByPlaceholder("Message #general")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to channels" })).toBeHidden();
});

test("reduced motion removes transitions but dialogs still open and close", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGeneral(page, "polishmotion");

  const add = page.getByRole("button", { name: "Add channel" });
  const duration = await add.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(duration).toBeLessThan(0.001);

  await add.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("keyboard focus is visible on sidebar controls", async ({ page }) => {
  await openGeneral(page, "polishfocus");
  await page.getByRole("button", { name: "general" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");

  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
});

test("the favicon is the Link mark", async ({ page }) => {
  const response = await page.request.get("/favicon.svg");
  expect(response.ok()).toBe(true);
  const svg = await response.text();
  expect(svg).toContain('fill="#B8452A"');
  expect(svg.length).toBeLessThan(1000);
});
