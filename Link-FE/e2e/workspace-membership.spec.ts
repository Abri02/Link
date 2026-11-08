import { test, expect, type Browser } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace } from "./helpers";

const API = "http://localhost:8080/api";

/** Owner creates a workspace and invites a second user through the API. */
async function setupOwnerAndMember(browser: Browser, tag: string) {
  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const member = await memberCtx.newPage();

  const ownerUser = uniqueUser(`${tag}owner`);
  const memberUser = uniqueUser(`${tag}member`);
  await signUp(owner, ownerUser.email, ownerUser.username);
  await signUp(member, memberUser.email, memberUser.username);

  const wsName = `${tag}-${Date.now()}`;
  await createWorkspace(owner, wsName);
  const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
  const wsId: number = workspaces.find((w: { name: string }) => w.name === wsName).id;
  const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
    data: { identifier: memberUser.username },
  });
  expect(invited.ok()).toBeTruthy();

  return { ownerCtx, memberCtx, owner, member, ownerUser, memberUser, wsName, wsId };
}

test.describe("Remove member / leave workspace", () => {
  test("owner removes a member, who then no longer sees the workspace", async ({ browser }) => {
    const { ownerCtx, memberCtx, owner, member, ownerUser, memberUser, wsName, wsId } =
      await setupOwnerAndMember(browser, "rmws");

    // The member sees the workspace but gets no remove buttons.
    await member.reload();
    await expect(member.getByRole("button", { name: wsName })).toBeVisible();
    await selectWorkspace(member, wsName);
    await expect(member.getByRole("button", { name: "general" })).toBeVisible();
    await expect(member.getByRole("button", { name: `Remove ${ownerUser.username}` })).toHaveCount(0);

    // The owner has no remove button for themselves, only for the member.
    await owner.reload();
    await selectWorkspace(owner, wsName);
    await expect(owner.getByRole("button", { name: `Remove ${ownerUser.username}` })).toHaveCount(0);
    owner.once("dialog", (d) => d.accept());
    const deleted = owner.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes(`/workspaces/${wsId}/members/`),
    );
    await owner.getByRole("button", { name: `Remove ${memberUser.username}` }).click();
    expect((await deleted).status()).toBe(204);
    await expect(owner.getByRole("button", { name: `Remove ${memberUser.username}` })).toHaveCount(0);
    await expect(owner.getByText("Members — 1")).toBeVisible();

    // The removed user no longer sees the workspace and is locked out of its channels.
    await member.reload();
    await expect(member.getByRole("button", { name: "Create workspace" })).toBeVisible();
    await expect(member.getByRole("button", { name: wsName })).toHaveCount(0);
    const channels = await member.request.get(`${API}/workspaces/${wsId}/channels`);
    expect(channels.status()).toBe(403);

    await ownerCtx.close();
    await memberCtx.close();
  });

  test("a member leaves the workspace, but the last owner can't", async ({ browser }) => {
    const { ownerCtx, memberCtx, owner, member, memberUser, wsName } =
      await setupOwnerAndMember(browser, "lvws");

    // The member leaves through the sidebar header button.
    await member.reload();
    await selectWorkspace(member, wsName);
    await expect(member.getByRole("button", { name: "general" })).toBeVisible();
    member.once("dialog", (d) => d.accept());
    await member.getByRole("button", { name: "Leave workspace" }).click();
    await expect(member.getByRole("button", { name: wsName })).toHaveCount(0);
    await expect(member.getByText("Select a workspace", { exact: true })).toBeVisible();

    // The owner's member list no longer contains them.
    await owner.reload();
    await selectWorkspace(owner, wsName);
    await expect(owner.getByText("Members — 1")).toBeVisible();
    await expect(owner.getByText(memberUser.username)).toHaveCount(0);

    // The last owner is refused (409) and stays in the workspace.
    owner.once("dialog", (d) => d.accept());
    await owner.getByRole("button", { name: "Leave workspace" }).click();
    await expect(owner.getByRole("alert")).toContainText("last OWNER");
    await expect(owner.getByRole("button", { name: wsName })).toBeVisible();

    await ownerCtx.close();
    await memberCtx.close();
  });
});
