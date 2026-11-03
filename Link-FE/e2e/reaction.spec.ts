import { test, expect } from "@playwright/test";
import { setupTwoUsersInWorkspace, sendMessage } from "./helpers";

test.describe("Reactions", () => {
  test("reacting shows a count of 1 for both users, and toggling it removes it", async ({ browser }) => {
    const { a, b, close } = await setupTwoUsersInWorkspace(browser, "react");

    const body = `react to me ${Date.now()}`;
    await sendMessage(a, "general", body);
    // B receiving the message proves B's channel socket (and its reactions topic) is subscribed.
    await expect(b.getByText(body)).toBeVisible();

    await a.getByText(body).hover();
    await a.getByRole("button", { name: "Add reaction" }).click();
    await a.getByRole("button", { name: "🎉" }).click();

    await expect(a.getByRole("button", { name: "🎉 1" })).toBeVisible();
    await expect(b.getByRole("button", { name: "🎉 1" })).toBeVisible();

    // Clicking your own reaction again removes it, for both users.
    await a.getByRole("button", { name: "🎉 1" }).click();
    await expect(a.getByRole("button", { name: /🎉/ })).toHaveCount(0);
    await expect(b.getByRole("button", { name: /🎉/ })).toHaveCount(0);

    await close();
  });
});
