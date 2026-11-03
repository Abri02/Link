import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, createChannel } from "./helpers";

const API = "http://localhost:8080/api";

test.describe("Change member role", () => {
  test("owner promotes a member to admin, who can then create a channel", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const member = await memberCtx.newPage();

    const ownerUser = uniqueUser("rbacowner");
    const memberUser = uniqueUser("rbacmember");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(member, memberUser.email, memberUser.username);

    const wsName = `Rbac-${Date.now()}`;
    await createWorkspace(owner, wsName);
    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: memberUser.username },
    });
    expect(invited.ok()).toBeTruthy();

    // Before promotion: a plain member can't create channels and sees no role dropdowns.
    await member.reload();
    await selectWorkspace(member, wsName);
    await expect(member.getByRole("button", { name: "general" })).toBeVisible();
    await expect(member.getByRole("button", { name: "Add channel" })).toHaveCount(0);
    await expect(member.getByLabel(`Role for ${ownerUser.username}`)).toHaveCount(0);

    // The owner promotes the member through the dropdown in the member list.
    await owner.reload();
    await selectWorkspace(owner, wsName);
    const roleSelect = owner.getByLabel(`Role for ${memberUser.username}`);
    await expect(roleSelect).toHaveValue("MEMBER");
    const patched = owner.waitForResponse(
      (r) => r.request().method() === "PATCH" && r.url().includes(`/workspaces/${wsId}/members/`),
    );
    await roleSelect.selectOption("ADMIN");
    expect((await patched).status()).toBe(200);
    await expect(roleSelect).toHaveValue("ADMIN");

    // The last owner can't demote themselves: the backend answers 409 and the UI shows it.
    await owner.getByLabel(`Role for ${ownerUser.username}`).selectOption("MEMBER");
    await expect(owner.getByRole("alert")).toContainText("last OWNER");
    await expect(owner.getByLabel(`Role for ${ownerUser.username}`)).toHaveValue("OWNER");

    // The new admin can now create a channel.
    await member.reload();
    await selectWorkspace(member, wsName);
    const channelName = `admin-made-${Date.now()}`;
    await createChannel(member, channelName);
    await expect(member.getByRole("button", { name: channelName })).toBeVisible();

    await ownerCtx.close();
    await memberCtx.close();
  });
});
