import { test, expect, type Page } from "@playwright/test";
import { API, addUserToWorkspace, setupTwoUsersInWorkspace, selectWorkspace, waitForSubscription } from "./helpers";

const conversationsOf = (page: Page) => page.getByText("DIRECT MESSAGES", { exact: true }).locator("..");

/** Reloads so the page's conversation socket is subscribed before anyone acts. */
async function reloadWithConversationSocket(page: Page, wsName: string) {
  const subscribed = waitForSubscription(page, "/user/queue/conversations");
  await page.reload();
  await subscribed;
  await selectWorkspace(page, wsName);
}

/** Opens a conversation from the sidebar and waits until its message topic is subscribed. */
async function openConversation(page: Page, name: RegExp) {
  const subscribed = waitForSubscription(page, "/topic/channel.");
  await conversationsOf(page).getByRole("button", { name }).click();
  await subscribed;
}

async function send(page: Page, placeholder: string, body: string) {
  const composer = page.getByPlaceholder(placeholder, { exact: true });
  await composer.fill(body);
  await composer.press("Enter");
}

test.describe("Group DMs", () => {
  test("three people chat live, B renames it, and C stops receiving after leaving", async ({ browser }) => {
    const { a, b, userB, wsName, wsId, close } = await setupTwoUsersInWorkspace(browser, "gdm");
    const { page: c, ctx: ctxC, user: userC } = await addUserToWorkspace(browser, a, wsId, wsName, "gdmc");
    await a.reload();
    await selectWorkspace(a, wsName);
    await reloadWithConversationSocket(b, wsName);
    await reloadWithConversationSocket(c, wsName);

    // A starts a named group DM with B and C.
    await a.getByRole("button", { name: "New message" }).click();
    const dialog = a.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: userB.username }).check();
    await dialog.getByRole("checkbox", { name: userC.username }).check();
    await dialog.getByPlaceholder("e.g. Launch crew").fill("Launch crew");
    await dialog.getByRole("button", { name: "Start conversation" }).click();
    await expect(dialog).toBeHidden();
    const placeholder = "Message Launch crew";
    await expect(a.getByPlaceholder(placeholder, { exact: true })).toBeVisible();

    // B and C see it in the sidebar without reloading.
    for (const page of [b, c]) {
      await expect(conversationsOf(page).getByRole("button", { name: /Launch crew/ })).toBeVisible();
      await openConversation(page, /Launch crew/);
    }

    // Everyone receives everyone's messages live.
    const fromA = `hello team ${Date.now()}`;
    await send(a, placeholder, fromA);
    for (const page of [a, b, c]) await expect(page.getByText(fromA)).toBeVisible();
    const fromC = `hi from C ${Date.now()}`;
    await send(c, placeholder, fromC);
    for (const page of [a, b, c]) await expect(page.getByText(fromC)).toBeVisible();

    // B renames it. Everyone sees a system message and the new name.
    b.once("dialog", (d) => d.accept("Launch v2"));
    await b.getByRole("button", { name: "Conversation options" }).click();
    await b.getByRole("menuitem", { name: "Rename" }).click();
    for (const page of [a, b, c]) {
      await expect(page.getByText(`${userB.username} renamed the conversation to "Launch v2"`)).toBeVisible();
      await expect(conversationsOf(page).getByRole("button", { name: /Launch v2/ })).toBeVisible();
    }

    // C leaves. A and B see the system message, and C's sidebar drops the conversation.
    c.once("dialog", (d) => d.accept());
    await c.getByRole("button", { name: "Conversation options" }).click();
    await c.getByRole("menuitem", { name: "Leave conversation" }).click();
    await expect(conversationsOf(c).getByRole("button", { name: /Launch v2/ })).toHaveCount(0);
    await expect(c.getByText("Select a channel")).toBeVisible();
    for (const page of [a, b]) {
      await expect(page.getByText(`${userC.username} left the conversation`)).toBeVisible();
    }

    // After leaving, C no longer receives messages and can't read the conversation.
    const afterLeave = `C is gone ${Date.now()}`;
    await send(a, "Message Launch v2", afterLeave);
    await expect(b.getByText(afterLeave)).toBeVisible();
    await expect(c.getByText(afterLeave)).toHaveCount(0);
    const conversations = await (await a.request.get(`${API}/workspaces/${wsId}/dms`)).json();
    const groupId: number = conversations.find((x: { title: string | null }) => x.title === "Launch v2").id;
    const cRead = await c.request.get(`${API}/channels/${groupId}/messages`);
    expect(cRead.status()).toBe(403);

    // The old conversation's key now matches only A and B, so picking A, B and C again starts a new one.
    const members = await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const idOf = (username: string) => members.find((m: { username: string }) => m.username === username).userId;
    const reopened = await a.request.post(`${API}/workspaces/${wsId}/dms`, {
      data: { userIds: [idOf(userB.username), idOf(userC.username)] },
    });
    expect(reopened.status()).toBe(201);
    expect((await reopened.json()).id).not.toBe(groupId);

    await ctxC.close();
    await close();
  });

  test("adding someone to a 1-on-1 DM starts a new group DM and keeps the DM", async ({ browser }) => {
    const { a, userB, wsName, wsId, close } = await setupTwoUsersInWorkspace(browser, "gdmadd");
    const { page: c, ctx: ctxC, user: userC } = await addUserToWorkspace(browser, a, wsId, wsName, "gdmaddc");
    await a.reload();
    await selectWorkspace(a, wsName);
    await reloadWithConversationSocket(c, wsName);

    // A opens a DM with B by clicking B in the member list.
    await a.getByRole("button", { name: userB.username, exact: true }).click();
    await expect(a.getByPlaceholder(`Message ${userB.username}`, { exact: true })).toBeVisible();

    await a.getByRole("button", { name: "Conversation options" }).click();
    await a.getByRole("menuitem", { name: "Add people" }).click();
    const dialog = a.getByRole("dialog");
    await expect(dialog.getByText("This starts a new group conversation.", { exact: false })).toBeVisible();
    await dialog.getByRole("checkbox", { name: userC.username }).check();
    await dialog.getByRole("button", { name: "Add people" }).click();
    await expect(dialog).toBeHidden();

    // A is now in the new group DM, named after B and C. The 1-on-1 is still listed.
    const groupName = `${userB.username}, ${userC.username}`;
    await expect(a.getByPlaceholder(`Message ${groupName}`, { exact: true })).toBeVisible();
    await expect(conversationsOf(a).getByRole("button", { name: userB.username, exact: true })).toBeVisible();
    await expect(conversationsOf(a).getByRole("button", { name: new RegExp(groupName) })).toBeVisible();

    // C sees the new group DM live and can read what A sends.
    const cName = new RegExp(`${userB.username}`);
    await expect(conversationsOf(c).getByRole("button", { name: cName })).toBeVisible();
    await openConversation(c, cName);
    const body = `welcome C ${Date.now()}`;
    await send(a, `Message ${groupName}`, body);
    await expect(c.getByText(body)).toBeVisible();

    await ctxC.close();
    await close();
  });
});
