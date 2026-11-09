import { test, expect, type Page } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace } from "./helpers";

async function invite(page: Page, identifier: string) {
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. alice or alice@example.com").fill(identifier);
  await dialog.getByRole("button", { name: "Invite" }).click();
  return dialog;
}

test.describe("Invite member", () => {
  test("invite by username and by email; unknown and duplicate users show an error", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const ownerUser = uniqueUser("invowner");
    const byName = uniqueUser("invname");
    const byEmail = uniqueUser("invmail");

    // Create the two invitees' accounts, each in a throwaway context.
    for (const u of [byName, byEmail]) {
      const ctx = await browser.newContext();
      await signUp(await ctx.newPage(), u.email, u.username);
      await ctx.close();
    }

    await signUp(owner, ownerUser.email, ownerUser.username);
    const wsName = `Invite-${Date.now()}`;
    await createWorkspace(owner, wsName);
    await selectWorkspace(owner, wsName);
    await expect(owner.getByText("Members — 1")).toBeVisible();

    let dialog = await invite(owner, byName.username);
    await expect(dialog).toBeHidden();
    await expect(owner.getByText("Members — 2")).toBeVisible();
    await expect(owner.getByRole("button", { name: byName.username, exact: true })).toBeVisible();

    dialog = await invite(owner, byEmail.email);
    await expect(dialog).toBeHidden();
    await expect(owner.getByText("Members — 3")).toBeVisible();
    await expect(owner.getByRole("button", { name: byEmail.username, exact: true })).toBeVisible();

    // Unknown user: the dialog stays open with an error and nobody is added.
    dialog = await invite(owner, `nobody${Date.now()}`);
    await expect(dialog.getByText("No user found with that username or email")).toBeVisible();
    await owner.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Already a member
    dialog = await invite(owner, byName.username);
    await expect(dialog.getByText("User is already a member")).toBeVisible();
    await owner.keyboard.press("Escape");
    await expect(owner.getByText("Members — 3")).toBeVisible();

    await ownerCtx.close();
  });
});
