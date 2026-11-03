import { test, expect } from "@playwright/test";
import { setupTwoUsersInWorkspace, sendMessage, selectWorkspace, selectChannel, waitForSubscription } from "./helpers";

test.describe("Threads", () => {
  test("a thread reply shows up live for the other user and counts on the root", async ({ browser }) => {
    const { a, b, wsName, close } = await setupTwoUsersInWorkspace(browser, "thread");

    const rootBody = `thread root ${Date.now()}`;
    await sendMessage(a, "general", rootBody);
    await expect(b.getByText(rootBody)).toBeVisible();

    // Both users open the thread. Wait until B's thread socket is subscribed before A replies.
    const bSubscribed = waitForSubscription(b, "/topic/thread.");
    await b.getByText(rootBody).hover();
    await b.getByRole("button", { name: "Reply in thread" }).click();
    await expect(b.getByRole("dialog").getByText("No replies yet.")).toBeVisible();
    await bSubscribed;

    await a.getByText(rootBody).hover();
    await a.getByRole("button", { name: "Reply in thread" }).click();
    const replyBody = `thread reply ${Date.now()}`;
    await sendMessage(a, "thread", replyBody);

    await expect(a.getByRole("dialog").getByText(replyBody)).toBeVisible();
    await expect(b.getByRole("dialog").getByText(replyBody)).toBeVisible();

    // Replies stay out of the channel timeline.
    await a.getByRole("button", { name: "Close thread" }).click();
    await expect(a.getByText(replyBody)).toHaveCount(0);

    // The root shows the reply count. It isn't pushed live, so check it after a reload.
    await a.reload();
    await selectWorkspace(a, wsName);
    await selectChannel(a, "general");
    const replyCount = a.getByRole("button", { name: "1 reply" });
    await expect(replyCount).toBeVisible();
    await replyCount.click();
    await expect(a.getByRole("dialog").getByText(replyBody)).toBeVisible();

    await close();
  });
});
