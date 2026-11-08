import { test, expect, type Page } from "@playwright/test";
import { API, addUserToWorkspace, selectChannel, selectWorkspace, setWorkspacePlan, setupTwoUsersInWorkspace } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/** Sidebar row of a conversation. A string matches the whole name (a 1-on-1 DM), a RegExp part of it. */
const dmRow = (page: Page, name: string | RegExp) =>
  page.getByText("DIRECT MESSAGES", { exact: true }).locator("..").getByRole("button", { name, exact: typeof name === "string" });

/** A clicks "Start call" until B's incoming-call dialog shows up (B's call socket may still be connecting). */
async function ring(a: Page, b: Page) {
  const dialog = b.getByRole("alertdialog", { name: "Incoming call" });
  await expect(async () => {
    const start = a.getByRole("button", { name: "Start call" });
    if (await start.isEnabled()) await start.click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return dialog;
}

/** Track `enabled` flags of the local stream shown in the call window. */
const localTracks = (page: Page) =>
  page.getByLabel("Your video").evaluate((v: HTMLVideoElement) => {
    const s = v.srcObject as MediaStream;
    return { audio: s.getAudioTracks().every((t) => t.enabled), video: s.getVideoTracks().every((t) => t.enabled) };
  });

async function setupDm(browser: Parameters<typeof setupTwoUsersInWorkspace>[0], tag: string) {
  const setup = await setupTwoUsersInWorkspace(browser, tag);
  const { a, b, wsId, wsName, userA, userB } = setup;
  const members: { userId: number; username: string }[] =
    await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
  const bId = members.find((m) => m.username === userB.username)!.userId;
  await setWorkspacePlan(a, wsId, "PREMIUM");
  await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } });
  // Both pick up the new DM and open it (B needs the DM cached to show A's name).
  for (const [page, other] of [[a, userB], [b, userA]] as const) {
    await page.reload();
    await selectWorkspace(page, wsName);
    await dmRow(page, other.username).click();
  }
  return setup;
}

test.describe("Call UI", () => {
  test("call button only in 1-on-1 DMs; B accepts, toggles mic and camera, A hangs up", async ({ browser }) => {
    const { a, b, userA, userB, wsId, wsName, close } = await setupDm(browser, "callui");

    // No call button in a channel or a group DM.
    const c = await addUserToWorkspace(browser, a, wsId, wsName, "calluic");
    await selectChannel(a, "general");
    await expect(a.getByRole("button", { name: "Start call" })).toHaveCount(0);
    const members: { userId: number; username: string }[] =
      await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: members.filter((m) => m.username !== userA.username).map((m) => m.userId) } });
    await a.reload();
    await selectWorkspace(a, wsName);
    await dmRow(a, new RegExp(c.user.username)).click();
    await expect(a.getByRole("button", { name: "Conversation options" })).toBeVisible();
    await expect(a.getByRole("button", { name: "Start call" })).toHaveCount(0);
    await c.ctx.close();

    // Back in the 1-on-1 DM: A calls, B sees who is calling and accepts.
    await dmRow(a, userB.username).click();
    const dialog = await ring(a, b);
    await expect(dialog).toContainText(`${userA.username} is calling you`);
    await expect(a.getByTestId("call-status")).toHaveText(`Calling ${userB.username}…`);
    await expect(a.getByRole("button", { name: "Start call" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Accept" }).click();
    await expect(dialog).toBeHidden();

    for (const [page, peer] of [[a, userB], [b, userA]] as const) {
      const call = page.getByRole("region", { name: "Call" });
      await expect(call.getByLabel("Remote video")).toBeVisible();
      await expect(call.getByLabel("Your video")).toBeVisible();
      await expect(page.getByTestId("call-status")).toHaveText(peer.username);
    }

    // B mutes the mic and turns the camera off, then back on.
    const mute = b.getByRole("button", { name: "Mute microphone" });
    const camera = b.getByRole("button", { name: "Turn off camera" });
    await mute.click();
    await camera.click();
    await expect(mute).toHaveAttribute("aria-pressed", "true");
    await expect(camera).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => localTracks(b)).toEqual({ audio: false, video: false });
    await mute.click();
    await camera.click();
    await expect.poll(() => localTracks(b)).toEqual({ audio: true, video: true });

    // A hangs up: both windows show "Call ended" and then close.
    await a.getByRole("button", { name: "Hang up" }).click();
    // ("Call ended" only stays for 3 s, so check both pages before waiting for the windows to close.)
    await Promise.all([a, b].map((page) => expect(page.getByTestId("call-status")).toHaveText("Call ended")));
    for (const page of [a, b]) await expect(page.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });

    await close();
  });

  test("B declines the incoming call", async ({ browser }) => {
    const { a, b, close } = await setupDm(browser, "calluirej");

    const dialog = await ring(a, b);
    await dialog.getByRole("button", { name: "Decline" }).click();
    await expect(dialog).toBeHidden();
    await expect(a.getByTestId("call-status")).toHaveText("Call declined");
    // The callee never gets a call window for a call they declined.
    await expect(b.getByRole("region", { name: "Call" })).toHaveCount(0);
    await expect(a.getByRole("region", { name: "Call" })).toBeHidden({ timeout: 10_000 });

    await close();
  });
});
