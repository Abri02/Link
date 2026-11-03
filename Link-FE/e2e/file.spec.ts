import { test, expect, type Page } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel } from "./helpers";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function attachAndSend(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/attachments") && r.request().method() === "POST"
  );
  await page.locator('input[type="file"]').setInputFiles(file);
  expect((await uploaded).status()).toBe(201);
  await page.getByPlaceholder("Message #general").press("Enter");
}

test.describe("File sharing", () => {
  test("an image renders inline and other files show as a download link", async ({ page }) => {
    const user = uniqueUser("file");
    await signUp(page, user.email, user.username);
    const wsName = `File-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    await attachAndSend(page, { name: "pixel.png", mimeType: "image/png", buffer: PNG });
    const img = page.getByRole("img", { name: "pixel.png" });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    await attachAndSend(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello file") });
    const link = page.locator('a[download="notes.txt"]');
    await expect(link).toBeVisible();
    await expect(page.getByRole("img", { name: "notes.txt" })).toHaveCount(0);
    await expect(link).toHaveAttribute("href", /\/api\/attachments\/\d+\/content$/);

    // The link serves the file's content.
    const res = await page.request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe("hello file");
  });
});
