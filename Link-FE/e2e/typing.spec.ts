import { test, expect, type Page } from "@playwright/test";
import { setupTwoUsersInWorkspace } from "./helpers";

const WS = "ws://localhost:8080/api/ws";

/** Types one character into #general; the composer throttles typing events to one per 3 s. */
const typeInGeneral = (page: Page) => page.getByPlaceholder("Message #general").press("x");

test.describe("Typing indicator", () => {
  test("B sees A typing, A does not see itself, and the indicator clears when A sends", async ({ browser }) => {
    const { a, b, userA, close } = await setupTwoUsersInWorkspace(browser, "typing");
    const indicatorB = b.getByTestId("typing-indicator");

    // Keep typing until B's typing subscription is live and the event arrives.
    await expect(async () => {
      await typeInGeneral(a);
      await expect(indicatorB).toHaveText(`${userA.username} is typing…`, { timeout: 3500 });
    }).toPass({ timeout: 20_000 });
    await expect(a.getByTestId("typing-indicator")).toHaveText("");

    await a.getByPlaceholder("Message #general").press("Enter");
    await expect(indicatorB).toHaveText("");

    await close();
  });

  test("the indicator expires about 5 s after A stops typing", async ({ browser }) => {
    const { a, b, userA, close } = await setupTwoUsersInWorkspace(browser, "typingexp");
    const indicatorB = b.getByTestId("typing-indicator");

    await expect(async () => {
      await typeInGeneral(a);
      await expect(indicatorB).toHaveText(`${userA.username} is typing…`, { timeout: 3500 });
    }).toPass({ timeout: 20_000 });

    const shownAt = Date.now();
    await expect(indicatorB).toHaveText("", { timeout: 8000 });
    expect(Date.now() - shownAt).toBeGreaterThan(1500);

    await close();
  });

  test("a client can't forge a typing event by SENDing straight to the topic", async ({ browser }) => {
    const { b, generalId, close } = await setupTwoUsersInWorkspace(browser, "typingforge");
    const topic = `/topic/channel.${generalId}.typing`;

    // B opens a raw STOMP connection, subscribes to the typing topic, then SENDs a forged event
    // straight to it, followed by a legitimate /app/typing frame.
    const received = await b.evaluate(
      ({ url, topic, channelId }) =>
        new Promise<{ afterForged: number; afterLegit: string[] }>((resolve, reject) => {
          const bodies: string[] = [];
          const ws = new WebSocket(url);
          ws.onerror = () => reject(new Error("WebSocket error"));
          ws.onopen = () => ws.send("CONNECT\naccept-version:1.2\nhost:localhost\n\n\0");
          ws.onmessage = (ev) => {
            const raw = String(ev.data);
            if (raw.startsWith("CONNECTED")) {
              ws.send(`SUBSCRIBE\nid:sub-0\ndestination:${topic}\n\n\0`);
              const forged = JSON.stringify({ channelId, userId: 999999, username: "forged" });
              ws.send(`SEND\ndestination:${topic}\ncontent-type:application/json\n\n${forged}\0`);
              setTimeout(() => {
                const afterForged = bodies.length;
                ws.send(`SEND\ndestination:/app/typing\ncontent-type:application/json\n\n${JSON.stringify({ channelId })}\0`);
                setTimeout(() => {
                  ws.close();
                  resolve({ afterForged, afterLegit: [...bodies] });
                }, 1500);
              }, 1500);
            } else if (raw.startsWith("MESSAGE")) {
              bodies.push(raw.slice(raw.indexOf("\n\n") + 2).replace(/\0$/, ""));
            }
          };
        }),
      { url: WS, topic, channelId: generalId },
    );

    expect(received.afterForged).toBe(0);
    expect(received.afterLegit).toHaveLength(1);
    expect(received.afterLegit[0]).not.toContain("forged");

    await close();
  });
});
