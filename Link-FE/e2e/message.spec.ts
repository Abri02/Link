import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

test.describe("Message", () => {
  test("sent message appears in the channel immediately", async ({ page }) => {
    const user = uniqueUser("msg");
    await signUp(page, user.email, user.username);

    const wsName = `MsgWS-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    const body = `Hello e2e ${Date.now()}`;
    await sendMessage(page, "general", body);

    await expect(page.getByText(body)).toBeVisible();
  });

  test("messages persist after page reload", async ({ page }) => {
    const user = uniqueUser("msgpersist");
    await signUp(page, user.email, user.username);

    const wsName = `PersistWS-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    const body = `Persist ${Date.now()}`;
    await sendMessage(page, "general", body);
    await expect(page.getByText(body)).toBeVisible();

    // Reload — Zustand resets, so re-select workspace and channel
    await page.reload();
    await page.getByRole("button", { name: wsName }).waitFor();
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    await expect(page.getByText(body)).toBeVisible();
  });

  test("multiple messages appear in send order", async ({ page }) => {
    const user = uniqueUser("msgorder");
    await signUp(page, user.email, user.username);

    const wsName = `OrderWS-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    const ts = Date.now();
    const first = `First-${ts}`;
    const second = `Second-${ts}`;

    await sendMessage(page, "general", first);
    await expect(page.getByText(first)).toBeVisible();

    await sendMessage(page, "general", second);
    await expect(page.getByText(second)).toBeVisible();

    // First message is still visible above the second
    const firstPos = await page.getByText(first).boundingBox();
    const secondPos = await page.getByText(second).boundingBox();
    expect(firstPos!.y).toBeLessThan(secondPos!.y);
  });
});
