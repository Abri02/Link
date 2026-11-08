import { test, expect, type Browser } from "@playwright/test";
import { API, uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

// No preset token or header (see playwright.config.ts): the app has to do the double-submit itself.
const cleanPage = async (browser: Browser) => {
  const context = await browser.newContext({ extraHTTPHeaders: {}, storageState: { cookies: [], origins: [] } });
  return context.newPage();
};

test.describe("CSRF double-submit", () => {
  test("the app sends the token, and a request without it gets 403", async ({ browser }) => {
    const page = await cleanPage(browser);
    const user = uniqueUser("csrf");
    await signUp(page, user.email, user.username);

    const cookies = await page.context().cookies();
    const token = cookies.find((c) => c.name === "XSRF-TOKEN");
    expect(token?.value).toBeTruthy();
    expect(token?.httpOnly).toBe(false);

    // Real UI writes: JSON through apiClient and a multipart upload.
    const wsName = `Csrf-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");
    await sendMessage(page, "general", "csrf protected hello");
    await expect(page.getByText("csrf protected hello")).toBeVisible();

    const uploaded = page.waitForResponse((r) => r.url().endsWith("/api/attachments") && r.request().method() === "POST");
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    expect((await uploaded).status()).toBe(201);

    // The session cookie alone is what a cross-site attacker gets.
    const missing = await page.request.post(`${API}/workspaces`, { data: { name: "nope" } });
    expect(missing.status()).toBe(403);
    const wrong = await page.request.post(`${API}/workspaces`, {
      data: { name: "nope" },
      headers: { "X-XSRF-TOKEN": "wrong" },
    });
    expect(wrong.status()).toBe(403);
    const matching = await page.request.post(`${API}/workspaces`, {
      data: { name: `Csrf-ok-${Date.now()}` },
      headers: { "X-XSRF-TOKEN": token!.value },
    });
    expect(matching.ok()).toBe(true);

    await page.context().close();
  });
});
