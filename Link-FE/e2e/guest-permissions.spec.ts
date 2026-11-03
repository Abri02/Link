import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

const API = "http://localhost:8080/api";

test.describe("Guest permissions", () => {
  test("a guest can post and react, but can't create channels, invite or open DMs", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const guest = await guestCtx.newPage();

    const ownerUser = uniqueUser("guestowner");
    const guestUser = uniqueUser("guest");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(guest, guestUser.email, guestUser.username);

    const wsName = `Guest-${Date.now()}`;
    await createWorkspace(owner, wsName);
    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;

    // The owner invites the guest through the invite dialog, picking the GUEST role.
    await selectWorkspace(owner, wsName);
    await owner.getByRole("button", { name: "Invite member" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByPlaceholder("e.g. alice or alice@example.com").fill(guestUser.username);
    const roleSelect = dialog.getByLabel("Role");
    await expect(roleSelect.locator("option")).toHaveText(["Member", "Guest"]);
    await roleSelect.selectOption("GUEST");
    const invited = owner.waitForResponse((r) => r.url().includes(`/workspaces/${wsId}/members/invite`));
    await dialog.getByRole("button", { name: "Invite" }).click();
    expect((await invited).status()).toBe(201);
    await expect(dialog).toBeHidden();
    const members = await (await owner.request.get(`${API}/workspaces/${wsId}/members`)).json();
    expect(members.find((m: { username: string }) => m.username === guestUser.username).role).toBe("GUEST");

    // Invites can't hand out ADMIN; that goes through a role change.
    const adminInvite = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: ownerUser.username, role: "ADMIN" },
    });
    expect(adminInvite.status()).toBe(400);

    // The guest sees the workspace, but no "Add channel" or invite button.
    await guest.reload();
    await selectWorkspace(guest, wsName);
    await selectChannel(guest, "general");
    await expect(guest.getByRole("button", { name: "Add channel" })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Invite member" })).toHaveCount(0);

    // The guest can post, and the owner sees it live.
    await selectWorkspace(owner, wsName);
    await selectChannel(owner, "general");
    const guestMsg = `guest says hi ${Date.now()}`;
    await sendMessage(guest, "general", guestMsg);
    await expect(guest.getByText(guestMsg)).toBeVisible();
    await expect(owner.getByText(guestMsg)).toBeVisible();

    // The guest can react to the owner's message.
    const ownerMsg = `owner says hi ${Date.now()}`;
    await sendMessage(owner, "general", ownerMsg);
    await expect(guest.getByText(ownerMsg)).toBeVisible();
    // The owner's message is the newest one, so its picker is the last "Add reaction" button.
    await guest.getByText(ownerMsg).hover();
    await guest.getByRole("button", { name: "Add reaction" }).last().click();
    const reacted = guest.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/reactions/"));
    await guest.getByRole("button", { name: "👍" }).click();
    expect((await reacted).status()).toBe(200);
    await expect(owner.getByRole("button", { name: "👍 1" })).toBeVisible();

    // Member names aren't clickable for the guest, and opening a DM through the API is refused.
    await expect(guest.getByText("MEMBERS — 2")).toBeVisible();
    await expect(guest.getByRole("button", { name: ownerUser.username, exact: true })).toHaveCount(0);
    const ownerId = members.find((m: { username: string }) => m.username === ownerUser.username).userId;
    const dm = await guest.request.post(`${API}/workspaces/${wsId}/dms`, { data: { targetUserId: ownerId } });
    expect(dm.status()).toBe(403);

    await ownerCtx.close();
    await guestCtx.close();
  });
});
