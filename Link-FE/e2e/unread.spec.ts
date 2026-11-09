import { test, expect, type Page } from "@playwright/test";
import { API, setupTwoUsersInWorkspace, selectWorkspace } from "./helpers";

/** Waits for the page's next "mark as read" call for this channel. */
const markedRead = (page: Page, channelId: number) =>
  page.waitForResponse((r) => r.url().endsWith(`/channels/${channelId}/read`) && r.request().method() === "POST");

test.describe("Persistent unread state", () => {
  test("a channel's unread badge survives a reload and is cleared once the channel is read", async ({ browser }) => {
    const { a, b, wsId, wsName, close } = await setupTwoUsersInWorkspace(browser, "unread");

    // A creates #news, B joins it, then A posts twice while B is in #general.
    const name = `news-${Date.now()}`;
    const created = await a.request.post(`${API}/workspaces/${wsId}/channels`, { data: { name } });
    const channelId: number = (await created.json()).id;
    expect((await b.request.post(`${API}/channels/${channelId}/members/me`)).ok()).toBe(true);
    for (const body of ["first", "second"]) {
      expect((await a.request.post(`${API}/channels/${channelId}/messages`, { data: { body } })).ok()).toBe(true);
    }

    // The count comes from the server, so it shows after a fresh load. The join message doesn't count.
    const row = () => b.getByRole("button", { name: new RegExp(name) });
    for (let i = 0; i < 2; i++) {
      await b.reload();
      await selectWorkspace(b, wsName);
      await expect(row().getByText("2", { exact: true })).toBeVisible();
    }

    // Opening the channel marks it as read on the server.
    const read = markedRead(b, channelId);
    await row().click();
    await read;
    await expect(b.getByText("second", { exact: true })).toBeVisible();
    await expect(row().getByText("2", { exact: true })).toHaveCount(0);

    // A message that arrives while B has the channel open is read too.
    const liveRead = markedRead(b, channelId);
    await a.request.post(`${API}/channels/${channelId}/messages`, { data: { body: "third" } });
    await expect(b.getByText("third", { exact: true })).toBeVisible();
    await liveRead;

    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(row()).toBeVisible();
    await expect(row().getByText(/^\d+$/)).toHaveCount(0);

    await close();
  });

  test("a DM's unread badge survives a reload", async ({ browser }) => {
    const { a, b, userA, userB, wsId, wsName, close } = await setupTwoUsersInWorkspace(browser, "unreaddm");

    const members: { userId: number; username: string }[] =
      await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const bId = members.find((m) => m.username === userB.username)!.userId;
    const dm = await (await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } })).json();
    for (const body of ["hi", "are you there?", "ping"]) {
      await a.request.post(`${API}/channels/${dm.id}/messages`, { data: { body } });
    }

    await b.reload();
    await selectWorkspace(b, wsName);
    const bDm = b.getByText("Direct messages", { exact: true }).locator("..")
      .getByRole("button", { name: new RegExp(userA.username) });
    await expect(bDm.getByText("3", { exact: true })).toBeVisible();

    const read = markedRead(b, dm.id);
    await bDm.click();
    await read;
    await expect(b.getByText("ping", { exact: true })).toBeVisible();

    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(bDm).toBeVisible();
    await expect(bDm.getByText("3", { exact: true })).toHaveCount(0);

    await close();
  });
});
