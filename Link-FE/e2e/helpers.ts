import { type Page } from "@playwright/test";

const PASSWORD = "TestPass1!";

export function uniqueUser(tag: string) {
  const ts = Date.now();
  return { email: `e2e.${tag}.${ts}@test.local`, username: `e2e${tag}${ts}` };
}

export async function signUp(page: Page, email: string, username: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Smith").fill("E2E User");
  await page.getByPlaceholder("janesmith").fill(username);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL("/");
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("/");
}

export async function createWorkspace(page: Page, name: string) {
  // Use aria-label selector — only the sidebar IconButton has it, not the dialog submit
  await page.locator('[aria-label="Create workspace"]').click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByPlaceholder("e.g. My Company").fill(name);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name }).waitFor();
}

export async function selectWorkspace(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}

export async function createChannel(page: Page, name: string) {
  await page.getByRole("button", { name: "Add channel" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. announcements").fill(name);
  await dialog.getByRole("button", { name: "Create channel" }).click();
  await page.getByRole("button", { name }).waitFor();
}

export async function selectChannel(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}

export async function sendMessage(page: Page, channelName: string, body: string) {
  await page.getByPlaceholder(`Message #${channelName}`).fill(body);
  await page.getByPlaceholder(`Message #${channelName}`).press("Enter");
}
