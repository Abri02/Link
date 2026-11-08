import { test, expect, type Page } from "@playwright/test";
import { API, setWorkspacePlan, setupTwoUsersInWorkspace } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/**
 * These specs drive `useWebRtcCall` directly through its store, so they also cover paths the UI
 * can't easily trigger (e.g. the 30 s timeout). The call UI is covered by `call-ui.spec.ts`. Importing the store's source URL from the Vite dev server returns the same module instance the
 * app uses.
 */
const STORE = "/src/feature/call/stores/callStore.ts";

type Control = "startCall" | "accept" | "reject" | "hangUp";

const control = (page: Page, name: Control, ...args: number[]) =>
  page.evaluate(
    async ({ store, name, args }) => {
      const { useCallStore } = await import(/* @vite-ignore */ store);
      useCallStore.getState().controls[name](...args);
    },
    { store: STORE, name, args },
  );

/** Status, end reason and peer of the call. Keeps the last local stream on window.__local. */
const callState = (page: Page) =>
  page.evaluate(async (store) => {
    const { useCallStore } = await import(/* @vite-ignore */ store);
    const s = useCallStore.getState();
    const w = window as unknown as { __local?: MediaStream };
    if (s.localStream) w.__local = s.localStream;
    return { status: s.status as string, endReason: s.endReason as string | null, peerUserId: s.peerUserId as number | null };
  }, STORE);

/** Plays the remote stream in a muted <video> and resolves once it has decoded frames. */
const remoteVideoPlays = (page: Page) =>
  page.evaluate(async (store) => {
    const { useCallStore } = await import(/* @vite-ignore */ store);
    const stream: MediaStream | null = useCallStore.getState().remoteStream;
    if (!stream) return false;
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    for (let i = 0; i < 50 && video.readyState < 2; i++) await new Promise((r) => setTimeout(r, 100));
    const playing = video.readyState >= 2 && video.videoWidth > 0;
    video.srcObject = null;
    return playing;
  }, STORE);

/** True once every track of the last local stream has been stopped. */
const localTracksStopped = (page: Page) =>
  page.evaluate(() => {
    const local = (window as unknown as { __local?: MediaStream }).__local;
    return !!local && local.getTracks().length > 0 && local.getTracks().every((t) => t.readyState === "ended");
  });

async function setupDm(browser: Parameters<typeof setupTwoUsersInWorkspace>[0], tag: string) {
  const setup = await setupTwoUsersInWorkspace(browser, tag);
  const { a, wsId, userA, userB } = setup;
  await setWorkspacePlan(a, wsId, "PREMIUM");
  const members: { userId: number; username: string }[] =
    await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
  const idOf = (username: string) => members.find((m) => m.username === username)!.userId;
  const dm = await (await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [idOf(userB.username)] } })).json();
  return { ...setup, aId: idOf(userA.username), bId: idOf(userB.username), dmId: dm.id as number };
}

/** A calls B and waits until B is ringing. Retries while the sockets are still connecting. */
async function ring(a: Page, b: Page, dmId: number, bId: number) {
  await expect(async () => {
    if ((await callState(a)).status === "idle") await control(a, "startCall", dmId, bId);
    expect((await callState(b)).status).toBe("ringing");
  }).toPass({ timeout: 20_000 });
}

test.describe("WebRTC call hook", () => {
  test("A calls B, B accepts, media flows both ways, A hangs up", async ({ browser }) => {
    const { a, b, aId, bId, dmId, close } = await setupDm(browser, "rtc");

    await ring(a, b, dmId, bId);
    expect(await callState(a)).toMatchObject({ status: "calling", peerUserId: bId });
    expect(await callState(b)).toMatchObject({ status: "ringing", peerUserId: aId });

    await control(b, "accept");
    for (const page of [a, b]) {
      await expect.poll(async () => (await callState(page)).status).toBe("connected");
      await expect.poll(() => remoteVideoPlays(page), { timeout: 20_000 }).toBe(true);
    }

    await control(a, "hangUp");
    await expect.poll(() => callState(a)).toMatchObject({ status: "ended", endReason: "hangup" });
    await expect.poll(() => callState(b)).toMatchObject({ status: "ended", endReason: "remote-hangup" });
    for (const page of [a, b]) {
      await expect.poll(() => localTracksStopped(page)).toBe(true);
      // `ended` goes back to `idle` after a few seconds.
      await expect.poll(async () => (await callState(page)).status, { timeout: 10_000 }).toBe("idle");
    }

    await close();
  });

  test("B rejects the call", async ({ browser }) => {
    const { a, b, bId, dmId, close } = await setupDm(browser, "rtcrej");

    await ring(a, b, dmId, bId);
    await control(b, "reject");
    await expect.poll(() => callState(a)).toMatchObject({ status: "ended", endReason: "rejected" });
    await expect.poll(() => callState(b)).toMatchObject({ status: "ended", endReason: "declined" });
    await expect.poll(() => localTracksStopped(a)).toBe(true);

    await close();
  });

  test("closing the tab during a call hangs up", async ({ browser }) => {
    const { a, b, bId, dmId, close } = await setupDm(browser, "rtctab");

    await ring(a, b, dmId, bId);
    await control(b, "accept");
    await expect.poll(async () => (await callState(a)).status).toBe("connected");

    await b.close({ runBeforeUnload: true });
    await expect.poll(() => callState(a), { timeout: 10_000 }).toMatchObject({ status: "ended", endReason: "remote-hangup" });
    await expect.poll(() => localTracksStopped(a)).toBe(true);

    await close();
  });

  test("an unanswered call times out after 30 s on both sides", async ({ browser }) => {
    test.setTimeout(90_000);
    const { a, b, bId, dmId, close } = await setupDm(browser, "rtcto");

    await ring(a, b, dmId, bId);
    await expect.poll(() => callState(a), { timeout: 40_000 }).toMatchObject({ status: "ended", endReason: "no-answer" });
    await expect.poll(() => callState(b), { timeout: 5_000 }).toMatchObject({ status: "ended", endReason: "remote-hangup" });
    await expect.poll(() => localTracksStopped(a)).toBe(true);

    await close();
  });
});
