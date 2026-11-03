import { test, expect } from "@playwright/test";
import { setupTwoUsersInWorkspace, selectWorkspace, waitForSubscription } from "./helpers";

test.describe("Direct messages", () => {
  test("A opens a DM with B, and B gets an unread badge and the message", async ({ browser }) => {
    const { a, b, userA, userB, wsName, close } = await setupTwoUsersInWorkspace(browser, "dm");

    // A clicks B's name in the member list, which opens the DM.
    await a.getByRole("button", { name: userB.username, exact: true }).click();
    const aDms = a.getByText("DIRECT MESSAGES", { exact: true }).locator("..");
    await expect(aDms.getByRole("button", { name: new RegExp(userB.username) })).toBeVisible();
    const composer = a.getByPlaceholder("Message #", { exact: true });
    await expect(composer).toBeVisible();

    // B reloads to pick up the new DM, stays in #general's workspace without opening the DM,
    // and waits for the notification socket before A sends.
    const bNotifications = waitForSubscription(b, "/user/queue/notifications");
    await b.reload();
    await bNotifications;
    await selectWorkspace(b, wsName);
    const bDm = b.getByText("DIRECT MESSAGES", { exact: true }).locator("..")
      .getByRole("button", { name: new RegExp(userA.username) });
    await expect(bDm).toBeVisible();

    const body = `psst ${Date.now()}`;
    await composer.fill(body);
    await composer.press("Enter");
    await expect(a.getByText(body)).toBeVisible();

    await expect(bDm.getByText("1", { exact: true })).toBeVisible();

    await bDm.click();
    await expect(b.getByText(body)).toBeVisible();
    await expect(bDm.getByText("1", { exact: true })).toHaveCount(0);

    await close();
  });
});
