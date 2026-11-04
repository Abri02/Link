import { test, expect, type Page } from "@playwright/test";
import { API, addUserToWorkspace, setupTwoUsersInWorkspace } from "./helpers";

const WS = "ws://localhost:8080/api/ws";

type Signal = { type: string; callId: string; toUserId: number; channelId: number; fromUserId?: number; payload?: unknown };

/**
 * Opens a raw STOMP connection in the page (the session cookie authenticates the handshake) and
 * subscribes to /user/queue/call. Received signals are stored on window.__signals.
 */
async function connectCallQueue(page: Page) {
  await page.evaluate(
    (url) =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as { __signals: Signal[]; __ws: WebSocket };
        w.__signals = [];
        const ws = new WebSocket(url);
        w.__ws = ws;
        ws.onerror = () => reject(new Error("WebSocket error"));
        ws.onopen = () => ws.send("CONNECT\naccept-version:1.2\nhost:localhost\n\n\0");
        ws.onmessage = (ev) => {
          const raw = String(ev.data);
          if (raw.startsWith("CONNECTED")) {
            ws.send("SUBSCRIBE\nid:call\ndestination:/user/queue/call\n\n\0");
            resolve();
          } else if (raw.startsWith("MESSAGE")) {
            w.__signals.push(JSON.parse(raw.slice(raw.indexOf("\n\n") + 2).replace(/\0$/, "")));
          }
        };
      }),
    WS,
  );
}

const sendSignal = (page: Page, signal: Signal) =>
  page.evaluate((body) => {
    const ws = (window as unknown as { __ws: WebSocket }).__ws;
    ws.send(`SEND\ndestination:/app/call.signal\ncontent-type:application/json\n\n${body}\0`);
  }, JSON.stringify(signal));

const received = (page: Page) =>
  page.evaluate(() => (window as unknown as { __signals: Signal[] }).__signals);

test.describe("Call signaling", () => {
  test("signals are relayed only between the two members of a 1-on-1 DM", async ({ browser }) => {
    const { a, b, userA, userB, wsId, wsName, close } = await setupTwoUsersInWorkspace(browser, "callsig");
    const c = await addUserToWorkspace(browser, a, wsId, wsName, "callsigc");

    const members: { userId: number; username: string }[] =
      await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const idOf = (username: string) => members.find((m) => m.username === username)!.userId;
    const [aId, bId, cId] = [idOf(userA.username), idOf(userB.username), idOf(c.user.username)];
    const dm = await (await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } })).json();

    for (const page of [a, b, c.page]) await connectCallQueue(page);

    // A rings B, with a forged fromUserId. Retry until B's subscription is live.
    const invite = { type: "INVITE", callId: `call-${Date.now()}`, toUserId: bId, channelId: dm.id, fromUserId: 999999 };
    await expect(async () => {
      await sendSignal(a, invite);
      expect((await received(b)).length).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });
    const first = (await received(b))[0];
    expect(first).toMatchObject({ type: "INVITE", callId: invite.callId, channelId: dm.id, toUserId: bId });
    expect(first.fromUserId).toBe(aId);

    const before = (await received(b)).length;
    // Dropped: A signals C, who is not in the DM. C signals B through A and B's DM.
    await sendSignal(a, { ...invite, toUserId: cId });
    await sendSignal(c.page, { ...invite, toUserId: bId });
    // Sentinel: once B gets this OFFER, the dropped frames have already been handled.
    const offer = { type: "OFFER", callId: invite.callId, toUserId: bId, channelId: dm.id, payload: { type: "offer", sdp: "v=0" } };
    await sendSignal(a, offer);
    await expect.poll(async () => (await received(b)).some((s) => s.type === "OFFER"), { timeout: 10_000 }).toBe(true);

    const atB = (await received(b)).slice(before);
    expect(atB).toHaveLength(1);
    expect(atB[0]).toMatchObject({ ...offer, fromUserId: aId });
    expect(await received(c.page)).toHaveLength(0);
    expect(await received(a)).toHaveLength(0);

    // B accepts and, once A has the ACCEPT, hangs up. A receives both, from B.
    // (Frames are not guaranteed to be relayed in send order, so the spec waits in between.)
    const back = { callId: invite.callId, toUserId: aId, channelId: dm.id };
    await sendSignal(b, { type: "ACCEPT", ...back });
    await expect.poll(async () => (await received(a)).map((s) => s.type), { timeout: 10_000 }).toEqual(["ACCEPT"]);
    await sendSignal(b, { type: "HANGUP", ...back });
    await expect.poll(async () => (await received(a)).map((s) => s.type), { timeout: 10_000 })
      .toEqual(["ACCEPT", "HANGUP"]);
    expect((await received(a)).every((s) => s.fromUserId === bId)).toBe(true);

    await c.ctx.close();
    await close();
  });
});
