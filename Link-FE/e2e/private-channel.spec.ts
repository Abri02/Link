import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace } from "./helpers";

const API = "http://localhost:8080/api";

test.describe("Private channel visibility", () => {
  test("a private channel is listed for its member but hidden from other workspace members", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const member = await memberCtx.newPage();

    const ownerUser = uniqueUser("pvowner");
    const memberUser = uniqueUser("pvmember");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(member, memberUser.email, memberUser.username);

    const wsName = `PrivVis-${Date.now()}`;
    await createWorkspace(owner, wsName);

    // The UI can't create private channels yet, so use the API with the owner's session cookie.
    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const secret = `secret-${Date.now()}`;
    const created = await owner.request.post(`${API}/workspaces/${wsId}/channels`, {
      data: { name: secret, kind: "PRIVATE" },
    });
    expect(created.status()).toBe(201);
    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: memberUser.username },
    });
    expect(invited.ok()).toBeTruthy();

    await owner.reload();
    await selectWorkspace(owner, wsName);
    await expect(owner.getByRole("button", { name: secret })).toBeVisible();

    await member.reload();
    await selectWorkspace(member, wsName);
    await expect(member.getByRole("button", { name: "general" })).toBeVisible();
    await expect(member.getByRole("button", { name: secret })).toHaveCount(0);

    await ownerCtx.close();
    await memberCtx.close();
  });
});
