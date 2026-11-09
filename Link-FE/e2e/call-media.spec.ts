import { test, expect, type Browser, type Page } from "@playwright/test";
import { API, selectWorkspace, setWorkspacePlan, setupTwoUsersInWorkspace } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

const dmRow = (page: Page, name: string) =>
  page.getByText("Direct messages", { exact: true }).locator("..").getByRole("button", { name, exact: true });

const button = (page: Page, name: string) => page.getByRole("button", { name });

const remoteVideo = (page: Page) => page.getByRole("region", { name: "Call" }).getByLabel("Remote video");

const videoSize = (page: Page) =>
  remoteVideo(page).evaluate((v: HTMLVideoElement) => ({ readyState: v.readyState, width: v.videoWidth, height: v.videoHeight }));

/** Connects a call between A and B. Runs `prepareB` on B's page before the app loads. */
async function connectedCall(
  browser: Browser,
  tag: string,
  prepareB?: (b: Page) => Promise<void>,
  prepareA?: (a: Page) => Promise<void>,
) {
  const setup = await setupTwoUsersInWorkspace(browser, tag);
  const { a, b, wsId, wsName, userA, userB } = setup;
  const members: { userId: number; username: string }[] =
    await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
  const bId = members.find((m) => m.username === userB.username)!.userId;
  await setWorkspacePlan(a, wsId, "PREMIUM");
  await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } });
  await prepareB?.(b);
  await prepareA?.(a);
  for (const [page, other] of [[a, userB], [b, userA]] as const) {
    await page.reload();
    await selectWorkspace(page, wsName);
    await dmRow(page, other.username).click();
  }

  const dialog = b.getByRole("alertdialog", { name: "Incoming call" });
  await expect(async () => {
    const start = button(a, "Start call");
    if (await start.isEnabled()) await start.click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Accept" }).click();

  await expect(a.getByTestId("call-status")).toHaveText(userB.username);
  await expect(b.getByTestId("call-status")).toHaveText(userA.username);
  return setup;
}

test.describe("Call media controls", () => {
  test("B can't open any device and still joins, and the buttons stay usable", async ({ browser }) => {
    const { a, b, userA, userB, close } = await connectedCall(browser, "nomedia", (page) =>
      page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Device in use", "NotReadableError"));
      }),
    );

    await expect(button(b, "Unmute microphone")).toBeEnabled();
    await expect(button(b, "Turn on camera")).toBeEnabled();

    // Retrying fails again, and nothing else changes.
    await button(b, "Unmute microphone").click();
    await button(b, "Turn on camera").click();
    await expect(button(b, "Turn on camera")).toBeEnabled();
    await b.waitForTimeout(2_000);

    await expect(b.getByRole("region", { name: "Call" })).toBeVisible();
    await expect(b.getByTestId("call-status")).toHaveText(userA.username);
    await expect(a.getByTestId("call-status")).toHaveText(userB.username);

    // A can still reach B: A's camera plays on B's side, even though B sends nothing.
    await button(a, "Turn on camera").click();
    await expect.poll(async () => (await videoSize(b)).width, { timeout: 20_000 }).toBeGreaterThan(0);

    await close();
  });

  test("both join with the camera off, A turns it on with no renegotiation, and off releases the device", async ({ browser }) => {
    const { a, b, close } = await connectedCall(browser, "camoff");

    await expect(button(a, "Turn on camera")).toBeVisible();
    await expect(button(b, "Turn on camera")).toBeVisible();
    expect((await videoSize(b)).width).toBe(0);

    await button(a, "Turn on camera").click();
    await expect(button(a, "Turn off camera")).toBeVisible();
    await expect.poll(async () => (await videoSize(b)).readyState, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    expect((await videoSize(b)).width).toBeGreaterThan(0);

    // Keep a handle on the track, because turning the camera off removes it from the stream.
    await a.getByLabel("Your video").evaluate((v: HTMLVideoElement) => {
      (window as unknown as { __camera: MediaStreamTrack }).__camera = (v.srcObject as MediaStream).getVideoTracks()[0];
    });
    await button(a, "Turn off camera").click();
    await expect(button(a, "Turn on camera")).toBeVisible();
    expect(await a.evaluate(() => (window as unknown as { __camera: MediaStreamTrack }).__camera.readyState)).toBe("ended");

    await close();
  });

  test("each side sees what the other has on", async ({ browser }) => {
    const { a, b, userA, close } = await connectedCall(browser, "peerstate");
    const placeholder = b.getByTestId("peer-camera-off");
    const muted = b.getByRole("img", { name: `${userA.username} is muted` });

    // Camera off: B sees A's name instead of the video, which stays mounted for the audio.
    await expect(button(a, "Mute microphone")).toBeVisible();
    await expect(placeholder).toContainText(userA.username);
    await expect(muted).toBeHidden();
    await expect(remoteVideo(b)).toHaveCount(1);
    await expect(a.getByLabel("Your video")).toHaveCount(0);
    await b.getByRole("region", { name: "Call" }).screenshot({ path: test.info().outputPath("camera-off.png") });

    await button(a, "Turn on camera").click();
    await expect(placeholder).toBeHidden();
    await expect(a.getByLabel("Your video")).toBeVisible();

    await button(a, "Mute microphone").click();
    await expect(muted).toBeVisible();
    await button(a, "Unmute microphone").click();
    await expect(muted).toBeHidden();

    await button(a, "Turn off camera").click();
    await expect(placeholder).toBeVisible();
    await expect(a.getByLabel("Your video")).toHaveCount(0);

    // A shared screen counts as video, even with the camera off.
    const share = button(a, "Share screen");
    await share.click();
    await expect(share).toHaveAttribute("aria-pressed", "true");
    await expect(placeholder).toBeHidden();
    await expect(a.getByLabel("Your video")).toBeVisible();
    await share.click();
    await expect(placeholder).toBeVisible();

    await close();
  });

  test("a screen share reaches the peer with the camera off", async ({ browser }) => {
    const { a, b, close } = await connectedCall(browser, "screenoff");
    const share = button(a, "Share screen");

    await share.click();
    await expect(share).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => {
      const { width, height } = await videoSize(b);
      return height > 0 ? width / height : 0;
    }, { timeout: 20_000 }).toBeCloseTo(16 / 9, 1);

    await share.click();
    await expect(share).toHaveAttribute("aria-pressed", "false");
    await expect(button(a, "Turn on camera")).toBeVisible();
    await expect(a.getByRole("region", { name: "Call" })).toBeVisible();

    await close();
  });

  test("device failures show why, clear on success, and never end the call", async ({ browser }) => {
    type TestWindow = Window & { __deviceError?: string; __tracks: MediaStreamTrack[] };
    const { a, b, userA, userB, close } = await connectedCall(browser, "devmsg", (page) =>
      page.addInitScript(() => {
        const win = window as unknown as TestWindow;
        win.__deviceError = "NotReadableError";
        const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = (constraints) =>
          win.__deviceError ? Promise.reject(new DOMException("Mocked", win.__deviceError)) : real(constraints);
      }),
    );
    const alert = b.getByRole("region", { name: "Call" }).getByRole("alert");
    const failWith = (name?: string) => b.evaluate((n) => { (window as unknown as TestWindow).__deviceError = n; }, name);

    // The mic is requested on joining, so its message appears with no click.
    await expect(alert).toHaveText("Your microphone is being used by another app.");

    for (const [name, control, text] of [
      ["NotAllowedError", "Turn on camera", "Access is blocked. Allow it in your browser's site settings."],
      ["NotFoundError", "Turn on camera", "No camera found."],
      ["NotReadableError", "Turn on camera", "Your camera is being used by another app."],
      ["NotFoundError", "Unmute microphone", "No microphone found."],
      ["AbortError", "Unmute microphone", "Couldn't open your microphone."],
    ]) {
      await failWith(name);
      await button(b, control).click();
      await expect(alert).toHaveText(text);
      await expect(b.getByTestId("call-status")).toHaveText(userA.username);
    }
    await expect(a.getByTestId("call-status")).toHaveText(userB.username);

    // The next successful toggle clears the message.
    await failWith(undefined);
    await button(b, "Unmute microphone").click();
    await expect(button(b, "Mute microphone")).toBeVisible();
    await expect(alert).toBeHidden();
    await button(b, "Turn on camera").click();
    await expect(button(b, "Turn off camera")).toBeVisible();

    // Unplugging: the browser stops the track and fires "ended". stop() alone doesn't fire it.
    await b.getByLabel("Your video").evaluate((v: HTMLVideoElement) => {
      (window as unknown as TestWindow).__tracks = (v.srcObject as MediaStream).getTracks();
    });
    const unplug = (kind: string) =>
      b.evaluate((k) => {
        const track = (window as unknown as TestWindow).__tracks.find((t) => t.kind === k)!;
        track.stop();
        track.dispatchEvent(new Event("ended"));
      }, kind);

    await unplug("video");
    await expect(button(b, "Turn on camera")).toBeVisible();
    await expect(alert).toHaveText("No camera found.");
    await expect(a.getByTestId("peer-camera-off")).toBeVisible();

    await unplug("audio");
    await expect(button(b, "Unmute microphone")).toBeVisible();
    await expect(alert).toHaveText("No microphone found.");
    await expect(a.getByRole("img", { name: `${userB.username} is muted` })).toBeVisible();

    await expect(b.getByTestId("call-status")).toHaveText(userA.username);
    await expect(a.getByTestId("call-status")).toHaveText(userB.username);

    await close();
  });

  test("without HTTPS a caller can still start a call and is told why devices are off", async ({ browser }) => {
    const { a, b, userA, userB, close } = await connectedCall(browser, "nohttps", undefined, (page) =>
      page.addInitScript(() => {
        // What the browser hides outside a secure context.
        Object.defineProperty(navigator, "mediaDevices", { value: undefined });
        Object.defineProperty(crypto, "randomUUID", { value: undefined });
      }),
    );

    const alert = a.getByRole("region", { name: "Call" }).getByRole("alert");
    await expect(alert).toHaveText("Calls need HTTPS or localhost for camera and microphone.");
    await expect(a.getByTestId("call-status")).toHaveText(userB.username);
    await expect(b.getByTestId("call-status")).toHaveText(userA.username);

    await close();
  });
});
