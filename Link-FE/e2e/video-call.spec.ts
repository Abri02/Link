import { test, expect, type Page } from "@playwright/test";
import { API, selectWorkspace, setupTwoUsersInWorkspace } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/**
 * End-to-end video through the real call UI: unlike `webrtc-call.spec.ts` (which drives the hook's
 * store), this checks that the `<video>` elements in the call window actually play.
 */

const dmRow = (page: Page, name: string) =>
  page.getByText("DIRECT MESSAGES", { exact: true }).locator("..").getByRole("button", { name, exact: true });

/** readyState, frame size and playback time of a `<video>` in the call window. */
const videoState = (page: Page, label: string) =>
  page
    .getByRole("region", { name: "Call" })
    .getByLabel(label)
    .evaluate((v: HTMLVideoElement) => ({ readyState: v.readyState, width: v.videoWidth, time: v.currentTime }));

/** The video has decoded frames and its playback time keeps moving (it isn't frozen). */
async function expectPlaying(page: Page, label: string) {
  await expect.poll(async () => (await videoState(page, label)).readyState, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const { width, time } = await videoState(page, label);
  expect(width).toBeGreaterThan(0);
  await expect.poll(async () => (await videoState(page, label)).time).toBeGreaterThan(time);
}

test.describe("Video call", () => {
  test("A calls B, B accepts, both videos play, A hangs up and B's window closes", async ({ browser }) => {
    const { a, b, wsId, wsName, userA, userB, close } = await setupTwoUsersInWorkspace(browser, "video");

    const members: { userId: number; username: string }[] =
      await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const bId = members.find((m) => m.username === userB.username)!.userId;
    await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } });
    for (const [page, other] of [[a, userB], [b, userA]] as const) {
      await page.reload();
      await selectWorkspace(page, wsName);
      await dmRow(page, other.username).click();
    }

    // A clicks "Start call" until B rings (B's call socket may still be connecting).
    const dialog = b.getByRole("alertdialog", { name: "Incoming call" });
    await expect(async () => {
      const start = a.getByRole("button", { name: "Start call" });
      if (await start.isEnabled()) await start.click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await dialog.getByRole("button", { name: "Accept" }).click();

    // Both sides see their own camera and the other's.
    for (const page of [a, b]) {
      await expectPlaying(page, "Your video");
      await expectPlaying(page, "Remote video");
    }

    await a.getByRole("button", { name: "Hang up" }).click();
    await expect(b.getByTestId("call-status")).toHaveText("Call ended");
    await expect(b.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });
    await expect(a.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });

    await close();
  });
});
