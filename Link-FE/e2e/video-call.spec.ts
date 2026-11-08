import { test, expect, type Browser, type Page } from "@playwright/test";
import { API, selectWorkspace, setWorkspacePlan, setupTwoUsersInWorkspace } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/**
 * End-to-end video through the real call UI: unlike `webrtc-call.spec.ts` (which drives the hook's
 * store), this checks that the `<video>` elements in the call window actually play.
 */

const dmRow = (page: Page, name: string) =>
  page.getByText("Direct messages", { exact: true }).locator("..").getByRole("button", { name, exact: true });

/** readyState, frame size and playback time of a `<video>` in the call window. */
const videoState = (page: Page, label: string) =>
  page
    .getByRole("region", { name: "Call" })
    .getByLabel(label)
    .evaluate((v: HTMLVideoElement) => ({
      readyState: v.readyState,
      width: v.videoWidth,
      height: v.videoHeight,
      time: v.currentTime,
    }));

/** The video has decoded frames and its playback time keeps moving (it isn't frozen). */
async function expectPlaying(page: Page, label: string) {
  await expect.poll(async () => (await videoState(page, label)).readyState, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const { width, time } = await videoState(page, label);
  expect(width).toBeGreaterThan(0);
  await expect.poll(async () => (await videoState(page, label)).time).toBeGreaterThan(time);
}

/** Width / height of the frames a `<video>` currently shows (0 before the first frame). */
const aspect = async (page: Page, label: string) => {
  const { width, height } = await videoState(page, label);
  return height > 0 ? width / height : 0;
};
// The fake camera is 4:3 (640x480) and the fake screen is 16:9 (1280x720).
const CAMERA = 4 / 3;
const SCREEN = 16 / 9;

/** Sets up a 1-on-1 DM between A and B, A calls, B accepts, and both videos play. */
async function connectedCall(browser: Browser, tag: string) {
  const setup = await setupTwoUsersInWorkspace(browser, tag);
  const { a, b, wsId, wsName, userA, userB } = setup;

  const members: { userId: number; username: string }[] =
    await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
  const bId = members.find((m) => m.username === userB.username)!.userId;
  await setWorkspacePlan(a, wsId, "PREMIUM");
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
  return setup;
}

test.describe("Video call", () => {
  test("A calls B, B accepts, both videos play, A hangs up and B's window closes", async ({ browser }) => {
    const { a, b, close } = await connectedCall(browser, "video");

    await a.getByRole("button", { name: "Hang up" }).click();
    await expect(b.getByTestId("call-status")).toHaveText("Call ended");
    await expect(b.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });
    await expect(a.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });

    await close();
  });

  test("A shares the screen, B sees it instead of the camera, and stopping goes back to the camera", async ({ browser }) => {
    const { a, b, close } = await connectedCall(browser, "screen");
    const share = a.getByRole("button", { name: "Share screen" });
    await expect.poll(() => aspect(b, "Remote video")).toBeCloseTo(CAMERA, 1);

    await share.click();
    await expect(share).toHaveAttribute("aria-pressed", "true");
    // A's preview and B's remote video switch to the 16:9 screen capture, and keep playing.
    await expect.poll(() => aspect(a, "Your video")).toBeCloseTo(SCREEN, 1);
    await expect.poll(() => aspect(b, "Remote video"), { timeout: 20_000 }).toBeCloseTo(SCREEN, 1);
    await expectPlaying(b, "Remote video");

    await share.click();
    await expect(share).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => aspect(a, "Your video")).toBeCloseTo(CAMERA, 1);
    await expect.poll(() => aspect(b, "Remote video"), { timeout: 20_000 }).toBeCloseTo(CAMERA, 1);
    await expectPlaying(b, "Remote video");

    // B can share too.
    await b.getByRole("button", { name: "Share screen" }).click();
    await expect.poll(() => aspect(a, "Remote video"), { timeout: 20_000 }).toBeCloseTo(SCREEN, 1);

    // Hanging up while sharing stops the capture and closes both windows.
    await b.getByRole("button", { name: "Hang up" }).click();
    await expect(a.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });
    await expect(b.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });

    await close();
  });
});
