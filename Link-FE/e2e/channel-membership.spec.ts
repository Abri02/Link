import { test, expect, type Page } from "@playwright/test";
import {
  API,
  createChannel,
  selectChannel,
  selectWorkspace,
  setupTwoUsersInWorkspace,
  uniqueUser,
  signUp,
  createWorkspace,
  waitForSubscription,
} from "./helpers";

/** The Channels section of the sidebar (the DM list and member list are separate sections). */
const channelsOf = (page: Page) => page.getByText("Channels", { exact: true }).locator("../..");

/** Reloads so the page's per-user socket (`/user/queue/channels`) is subscribed before anyone acts. */
async function reloadWithUserSocket(page: Page, wsName: string) {
  const subscribed = waitForSubscription(page, "/user/queue/channels");
  await page.reload();
  await subscribed;
  await selectWorkspace(page, wsName);
}

/** Opens a channel and waits until its message topic is subscribed, so live messages arrive. */
async function openChannel(page: Page, name: string) {
  const subscribed = waitForSubscription(page, "/topic/channel.");
  await channelsOf(page).getByRole("button", { name, exact: true }).click();
  await subscribed;
}

test.describe("Channel membership", () => {
  test("a member browses and joins a public channel, then leaves it, and the owner sees both live", async ({ browser }) => {
    const { a, b, userB, wsName, close } = await setupTwoUsersInWorkspace(browser, "chjoin");

    // A creates a public channel after B joined the workspace. B isn't in it, so B's sidebar doesn't list it.
    const news = `news-${Date.now()}`;
    await createChannel(a, news);
    await openChannel(a, news);
    await reloadWithUserSocket(b, wsName);
    await expect(channelsOf(b).getByRole("button", { name: "general", exact: true })).toBeVisible();
    await expect(channelsOf(b).getByRole("button", { name: news, exact: true })).toHaveCount(0);

    // #general can't be left, so it has no channel menu.
    await selectChannel(b, "general");
    await expect(b.getByPlaceholder("Message #general")).toBeVisible();
    await expect(b.getByRole("button", { name: "Channel options" })).toHaveCount(0);

    // B finds the channel in Browse channels and joins it. It opens, and A sees the join message live.
    await b.getByRole("button", { name: "Browse channels" }).click();
    const dialog = b.getByRole("dialog");
    await expect(dialog.getByText(news)).toBeVisible();
    await expect(dialog.getByText("general", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: `Join ${news}` }).click();
    await expect(dialog).toBeHidden();
    await expect(channelsOf(b).getByRole("button", { name: news, exact: true })).toBeVisible();
    await expect(b.getByPlaceholder(`Message #${news}`)).toBeVisible();
    await expect(a.getByText(`${userB.username} joined the channel`)).toBeVisible();

    // B can post in it now.
    const hello = `hello news ${Date.now()}`;
    await b.getByPlaceholder(`Message #${news}`).fill(hello);
    await b.getByPlaceholder(`Message #${news}`).press("Enter");
    await expect(a.getByText(hello)).toBeVisible();

    // B leaves. The channel drops out of B's sidebar, and A sees the leave message live.
    b.once("dialog", (d) => d.accept());
    await b.getByRole("button", { name: "Channel options" }).click();
    await b.getByRole("menuitem", { name: "Leave channel" }).click();
    await expect(channelsOf(b).getByRole("button", { name: news, exact: true })).toHaveCount(0);
    await expect(b.getByText("Select a channel")).toBeVisible();
    await expect(a.getByText(`${userB.username} left the channel`)).toBeVisible();

    // The channel is back in B's browse list.
    await b.getByRole("button", { name: "Browse channels" }).click();
    await expect(b.getByRole("dialog").getByText(news)).toBeVisible();

    await close();
  });

  test("the owner adds a member to a private channel and removes them, and the member's sidebar updates live", async ({ browser }) => {
    const { a, b, userB, wsName, wsId, close } = await setupTwoUsersInWorkspace(browser, "chpriv");

    // A creates a private channel through the UI.
    const secret = `secret-${Date.now()}`;
    await a.getByRole("button", { name: "Add channel" }).click();
    const create = a.getByRole("dialog");
    await create.getByPlaceholder("e.g. announcements").fill(secret);
    await create.getByRole("checkbox", { name: /Private/ }).check();
    await create.getByRole("button", { name: "Create channel" }).click();
    await expect(create).toBeHidden();
    await openChannel(a, secret);

    // B can't see it, and it isn't in B's browse list.
    await reloadWithUserSocket(b, wsName);
    await expect(channelsOf(b).getByRole("button", { name: secret, exact: true })).toHaveCount(0);
    const browse = await (await b.request.get(`${API}/workspaces/${wsId}/channels/browse`)).json();
    expect(browse.map((c: { name: string }) => c.name)).not.toContain(secret);

    // A adds B from the members dialog. B's sidebar shows the channel without a reload.
    await a.getByRole("button", { name: "Channel options" }).click();
    await a.getByRole("menuitem", { name: "Members" }).click();
    const members = a.getByRole("dialog");
    await members.getByLabel("Person to add").selectOption({ label: userB.username });
    await members.getByRole("button", { name: "Add", exact: true }).click();
    await expect(members.getByLabel("Channel members").getByText(userB.username)).toBeVisible();
    await expect(a.getByText(`added ${userB.username}`)).toBeVisible();
    await expect(channelsOf(b).getByRole("button", { name: secret, exact: true })).toBeVisible();

    // B (a plain MEMBER who didn't create it) sees the member list but can't manage it.
    await openChannel(b, secret);
    await b.getByRole("button", { name: "Channel options" }).click();
    await b.getByRole("menuitem", { name: "Members" }).click();
    const bMembers = b.getByRole("dialog");
    await expect(bMembers.getByText(userB.username)).toBeVisible();
    await expect(bMembers.getByLabel("Person to add")).toHaveCount(0);
    await expect(bMembers.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await b.keyboard.press("Escape");
    await expect(bMembers).toBeHidden();

    // A removes B. The channel drops out of B's sidebar live, and B is sent back to "Select a channel".
    await members.getByRole("button", { name: `Remove ${userB.username} from channel` }).click();
    await expect(members.getByLabel("Channel members").getByText(userB.username)).toHaveCount(0);
    await expect(channelsOf(b).getByRole("button", { name: secret, exact: true })).toHaveCount(0);
    await expect(b.getByText("Select a channel")).toBeVisible();

    await close();
  });

  test("a guest can't browse or join channels", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const guest = await guestCtx.newPage();
    const ownerUser = uniqueUser("chgowner");
    const guestUser = uniqueUser("chguest");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(guest, guestUser.email, guestUser.username);

    const wsName = `ChGuest-${Date.now()}`;
    await createWorkspace(owner, wsName);
    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId: number = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: guestUser.username, role: "GUEST" },
    });
    expect(invited.ok()).toBeTruthy();
    const later = await owner.request.post(`${API}/workspaces/${wsId}/channels`, { data: { name: `later-${Date.now()}` } });
    expect(later.status()).toBe(201);
    const laterId: number = (await later.json()).id;

    await guest.reload();
    await selectWorkspace(guest, wsName);
    await expect(channelsOf(guest).getByRole("button", { name: "general", exact: true })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Browse channels" })).toHaveCount(0);

    expect((await guest.request.get(`${API}/workspaces/${wsId}/channels/browse`)).status()).toBe(403);
    expect((await guest.request.post(`${API}/channels/${laterId}/members/me`)).status()).toBe(403);

    await ownerCtx.close();
    await guestCtx.close();
  });
});
