import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, createChannel, selectChannel } from "./helpers";

test.describe("Channel", () => {
  test("new workspace automatically has a #general channel", async ({ page }) => {
    const user = uniqueUser("chgen");
    await signUp(page, user.email, user.username);

    const wsName = `GenCh-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);

    await expect(page.getByRole("button", { name: "general" })).toBeVisible();
  });

  test("user can create a new channel and it appears in the list", async ({ page }) => {
    const user = uniqueUser("chnew");
    await signUp(page, user.email, user.username);

    const wsName = `ChNew-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);

    const chName = `alerts-${Date.now()}`;
    await createChannel(page, chName);

    await expect(page.getByRole("button", { name: chName })).toBeVisible();
  });

  test("selecting a channel opens the message composer for that channel", async ({ page }) => {
    const user = uniqueUser("chsel");
    await signUp(page, user.email, user.username);

    const wsName = `ChSel-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    await expect(page.getByPlaceholder("Message #general")).toBeVisible();
  });
});
