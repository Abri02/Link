import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "TestPass1!";

function uniqueUser(tag: string) {
  const ts = Date.now();
  return { email: `e2e.${tag}.${ts}@test.local`, username: `e2e${tag}${ts}` };
}

async function signUp(page: Page, email: string, username: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Smith").fill("E2E User");
  await page.getByPlaceholder("janesmith").fill(username);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL("/");
}

async function logOut(page: Page) {
  await page.getByRole("button", { name: /Log out/i }).click();
  await page.waitForURL("/login");
}

test.describe("Auth smoke", () => {
  test("two users sign up, persist across refresh, and log out", async ({ browser }) => {
    const userA = uniqueUser("a");
    const userB = uniqueUser("b");

    // ── User A ──────────────────────────────────────────────────────────
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    await signUp(pageA, userA.email, userA.username);
    await expect(pageA.getByText(userA.username)).toBeVisible();

    await pageA.reload();
    await expect(pageA).toHaveURL("/");
    await expect(pageA.getByText(userA.username)).toBeVisible();

    // ── User B (isolated context = separate session) ──────────────────
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();

    await signUp(pageB, userB.email, userB.username);
    await expect(pageB.getByText(userB.username)).toBeVisible();

    await pageB.reload();
    await expect(pageB).toHaveURL("/");
    await expect(pageB.getByText(userB.username)).toBeVisible();

    // Both still logged in simultaneously
    await expect(pageA).toHaveURL("/");

    // ── Log out both ──────────────────────────────────────────────────
    await logOut(pageA);
    await expect(pageA).toHaveURL("/login");

    await logOut(pageB);
    await expect(pageB).toHaveURL("/login");

    // Confirm guarded route redirects after logout
    await pageA.goto("/");
    await expect(pageA).toHaveURL("/login");

    await ctxA.close();
    await ctxB.close();
  });

  test("login with wrong password shows error", async ({ page }) => {
    const user = uniqueUser("err");
    await signUp(page, user.email, user.username);
    await logOut(page);

    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(user.email);
    await page.getByPlaceholder("••••••••").fill("WrongPassword!");
    await page.getByRole("button", { name: /Sign in/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("fields are labelled and a wrong password shows an alert", async ({ page }) => {
    const user = uniqueUser("label");
    await signUp(page, user.email, user.username);
    await logOut(page);

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("WrongPassword!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText(/Invalid email or password/i);
  });

  test("user can sign in with only the keyboard", async ({ page }) => {
    const user = uniqueUser("kbd");
    await signUp(page, user.email, user.username);
    await logOut(page);

    await page.goto("/login");
    await page.getByLabel("Email").waitFor();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.keyboard.type(user.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Enter");

    await page.waitForURL("/");
  });

  test("password can be shown and hidden", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("auth links navigate without reloading the page", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => { (window as unknown as { noReload: boolean }).noReload = true; });

    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page).toHaveURL("/signup");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");

    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);
  });

  test("unauthenticated user is redirected from / to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("logged-in user visiting /login is sent to /", async ({ page }) => {
    const user = uniqueUser("skip");
    await signUp(page, user.email, user.username);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});
