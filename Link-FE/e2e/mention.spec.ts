import { test, expect, type Page } from "@playwright/test";
import { API, setupTwoUsersInWorkspace, selectWorkspace, selectChannel, waitForSubscription } from "./helpers";

/** B's sidebar row for a channel. */
const channelRow = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("@mentions", () => {
  test("A picks B from the autocomplete, and B gets a mention badge that survives a reload", async ({ browser }) => {
    const { a, b, userB, wsId, wsName, close } = await setupTwoUsersInWorkspace(browser, "mention");

    // B sits in another channel so #general collects the badge.
    const side = `side-${Date.now()}`;
    const created = await a.request.post(`${API}/workspaces/${wsId}/channels`, { data: { name: side } });
    expect((await b.request.post(`${API}/channels/${(await created.json()).id}/members/me`)).ok()).toBe(true);
    const bNotifications = waitForSubscription(b, "/user/queue/notifications");
    await b.reload();
    await bNotifications;
    await selectWorkspace(b, wsName);
    await selectChannel(b, side);

    // A types "@" plus the start of B's name and picks B with the keyboard.
    const composer = a.getByPlaceholder("Message #general");
    await composer.fill("hey ");
    await composer.pressSequentially(`@${userB.username.slice(0, 8)}`);
    const suggestions = a.getByRole("listbox", { name: "Mention suggestions" });
    await expect(suggestions.getByRole("option", { name: `@${userB.username}` })).toBeVisible();
    // A doesn't get to mention themselves.
    await expect(suggestions.getByRole("option")).toHaveCount(1);
    await composer.press("Enter");
    await expect(suggestions).toBeHidden();
    await expect(composer).toHaveValue(`hey @${userB.username} `);

    await composer.pressSequentially("please review");
    await composer.press("Enter");
    await expect(a.locator(`[data-mention="${userB.username}"]`)).toBeVisible();

    // Live: B gets the mention badge and the unread count on #general.
    await expect(channelRow(b, "general").getByText("@1", { exact: true })).toBeVisible();
    await expect(channelRow(b, "general").getByText("1", { exact: true })).toBeVisible();

    // The count comes from the server, so it survives a reload.
    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(channelRow(b, "general").getByText("@1", { exact: true })).toBeVisible();

    // Opening #general reads it: the badge goes away and the mention is highlighted.
    await selectChannel(b, "general");
    await expect(b.locator(`[data-mention="${userB.username}"]`)).toBeVisible();
    await expect(channelRow(b, "general").getByText("@1", { exact: true })).toHaveCount(0);
    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(channelRow(b, "general")).toBeVisible();
    await expect(channelRow(b, "general").getByText("@1", { exact: true })).toHaveCount(0);

    await close();
  });

  test("a mention in a thread reply gives B a mention badge but no unread count", async ({ browser }) => {
    const { a, b, userB, wsId, wsName, generalId, close } = await setupTwoUsersInWorkspace(browser, "mentionthr");

    // B reads a parent message in #general, then moves to another channel.
    const parent = await (await a.request.post(`${API}/channels/${generalId}/messages`, { data: { body: "parent" } })).json();
    await expect(b.getByText("parent", { exact: true })).toBeVisible();
    expect((await b.request.post(`${API}/channels/${generalId}/read`)).ok()).toBe(true);
    const side = `side-${Date.now()}`;
    const created = await a.request.post(`${API}/workspaces/${wsId}/channels`, { data: { name: side } });
    expect((await b.request.post(`${API}/channels/${(await created.json()).id}/members/me`)).ok()).toBe(true);
    await b.reload();
    await selectWorkspace(b, wsName);
    await selectChannel(b, side);
    await expect(b.getByPlaceholder(`Message #${side}`)).toBeVisible();

    const reply = await a.request.post(`${API}/channels/${generalId}/messages`, {
      data: { body: `@${userB.username} what do you think?`, parentMessageId: parent.id },
    });
    expect(reply.ok()).toBe(true);

    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(channelRow(b, "general").getByText("@1", { exact: true })).toBeVisible();
    // Thread replies aren't counted as unread top-level messages.
    await expect(channelRow(b, "general").getByText(/^\d+$/)).toHaveCount(0);

    await close();
  });
});
