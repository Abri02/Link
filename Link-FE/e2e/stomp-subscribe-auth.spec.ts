import { test, expect, type Page } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace } from "./helpers";

const API = "http://localhost:8080/api";
const WS = "ws://localhost:8080/api/ws";

type ReceivedFrame = { destination: string; body: string };

/**
 * Opens a raw STOMP connection in the page (the session cookie authenticates the handshake)
 * and subscribes to the given destinations. Received MESSAGE frames are stored on window.__frames.
 */
async function rawSubscribe(page: Page, destinations: string[]) {
  await page.evaluate(
    ({ url, dests }) =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as { __frames: ReceivedFrame[] };
        w.__frames = [];
        const ws = new WebSocket(url);
        ws.onerror = () => reject(new Error("WebSocket error"));
        ws.onopen = () => ws.send("CONNECT\naccept-version:1.2\nhost:localhost\n\n\0");
        ws.onmessage = (ev) => {
          const raw = String(ev.data);
          if (raw.startsWith("CONNECTED")) {
            dests.forEach((d, i) => ws.send(`SUBSCRIBE\nid:sub-${i}\ndestination:${d}\n\n\0`));
            resolve();
          } else if (raw.startsWith("MESSAGE")) {
            const destination = /\ndestination:([^\n]*)/.exec(raw)?.[1] ?? "";
            w.__frames.push({ destination, body: raw.slice(raw.indexOf("\n\n") + 2) });
          }
        };
      }),
    { url: WS, dests: destinations },
  );
}

const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __frames: ReceivedFrame[] }).__frames);

test.describe("STOMP subscribe authorization", () => {
  test("a workspace member receives live events for joined channels but not for a private channel", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const member = await memberCtx.newPage();

    const ownerUser = uniqueUser("subowner");
    const memberUser = uniqueUser("submember");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(member, memberUser.email, memberUser.username);

    const wsName = `SubAuth-${Date.now()}`;
    await createWorkspace(owner, wsName);

    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const secretRes = await owner.request.post(`${API}/workspaces/${wsId}/channels`, {
      data: { name: `secret-${Date.now()}`, kind: "PRIVATE" },
    });
    expect(secretRes.status()).toBe(201);
    const secretId = (await secretRes.json()).id;
    const channels = await (await owner.request.get(`${API}/workspaces/${wsId}/channels`)).json();
    const generalId = channels.find((c: { name: string }) => c.name === "general").id;

    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: memberUser.username },
    });
    expect(invited.ok()).toBeTruthy();

    // The member is in #general (auto-joined) but not in the private channel.
    await rawSubscribe(member, [
      `/topic/channel.${generalId}`,
      `/topic/channel.${secretId}`,
      `/topic/reactions.${secretId}`,
      "/topic/*",
    ]);

    const send = (channelId: number, body: string) =>
      owner.request.post(`${API}/channels/${channelId}/messages`, { data: { body } });

    // Wait until the allowed subscription is live.
    expect((await send(generalId, "warmup")).ok()).toBeTruthy();
    await expect.poll(async () => (await frames(member)).length, { timeout: 10_000 }).toBeGreaterThan(0);

    expect((await send(secretId, "top secret")).ok()).toBeTruthy();
    // Sentinel on #general: once it arrives, the secret broadcast has already been delivered (or dropped).
    expect((await send(generalId, "sentinel")).ok()).toBeTruthy();
    await expect
      .poll(async () => (await frames(member)).some((f) => f.body.includes("sentinel")), { timeout: 10_000 })
      .toBe(true);

    const received = await frames(member);
    expect(received.every((f) => f.destination === `/topic/channel.${generalId}`)).toBe(true);
    expect(received.some((f) => f.body.includes("top secret"))).toBe(false);

    await ownerCtx.close();
    await memberCtx.close();
  });
});
