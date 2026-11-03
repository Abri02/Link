import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

const API = "http://localhost:8080/api";

test.describe("Message moderation", () => {
  test("an admin deletes another user's message, a plain member can't", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const adminCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const admin = await adminCtx.newPage();
    const member = await memberCtx.newPage();

    const ownerUser = uniqueUser("modowner");
    const adminUser = uniqueUser("modadmin");
    const memberUser = uniqueUser("modmember");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(admin, adminUser.email, adminUser.username);
    await signUp(member, memberUser.email, memberUser.username);

    const wsName = `Mod-${Date.now()}`;
    await createWorkspace(owner, wsName);
    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    for (const u of [adminUser, memberUser]) {
      const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
        data: { identifier: u.username },
      });
      expect(invited.ok()).toBeTruthy();
    }
    const members = await (await owner.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const adminId = members.find((m: { username: string }) => m.username === adminUser.username).userId;
    const promoted = await owner.request.patch(`${API}/workspaces/${wsId}/members/${adminId}`, {
      data: { role: "ADMIN" },
    });
    expect(promoted.ok()).toBeTruthy();

    // The member and the owner each post in #general.
    await member.reload();
    await selectWorkspace(member, wsName);
    await selectChannel(member, "general");
    const memberMsg = `member says hi ${Date.now()}`;
    await sendMessage(member, "general", memberMsg);
    await expect(member.getByText(memberMsg)).toBeVisible();

    await selectWorkspace(owner, wsName);
    await selectChannel(owner, "general");
    const ownerMsg = `owner says hi ${Date.now()}`;
    await sendMessage(owner, "general", ownerMsg);
    await expect(member.getByText(ownerMsg)).toBeVisible();

    // A plain member gets no actions menu on someone else's message, and the API refuses too.
    await member.getByText(ownerMsg).hover();
    await expect(member.getByRole("button", { name: "Reply in thread" })).toBeVisible();
    await expect(member.getByRole("button", { name: "Message actions" })).toHaveCount(0);
    const channels = await (await member.request.get(`${API}/workspaces/${wsId}/channels`)).json();
    const generalId = channels.find((c: { name: string }) => c.name === "general").id;
    const msgs = await (await member.request.get(`${API}/channels/${generalId}/messages`)).json();
    const ownerMsgId = msgs.find((m: { body: string }) => m.body === ownerMsg).id;
    const forbidden = await member.request.delete(`${API}/channels/${generalId}/messages/${ownerMsgId}`);
    expect(forbidden.status()).toBe(403);

    // The admin sees "Delete" (but not "Edit") on the member's message and removes it.
    await admin.reload();
    await selectWorkspace(admin, wsName);
    await selectChannel(admin, "general");
    await admin.getByText(memberMsg).hover();
    await admin.getByRole("button", { name: "Message actions" }).click();
    await expect(admin.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
    const deleted = admin.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes(`/channels/${generalId}/messages/`),
    );
    await admin.getByRole("menuitem", { name: "Delete" }).click();
    expect((await deleted).status()).toBe(204);
    await expect(admin.getByText(memberMsg)).toHaveCount(0);

    // Everyone else sees it disappear live, and the owner's message is untouched.
    await expect(member.getByText(memberMsg)).toHaveCount(0);
    await expect(owner.getByText(memberMsg)).toHaveCount(0);
    await expect(member.getByText(ownerMsg)).toBeVisible();

    await ownerCtx.close();
    await adminCtx.close();
    await memberCtx.close();
  });
});
