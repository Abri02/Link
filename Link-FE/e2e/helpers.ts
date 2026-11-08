import { createHmac, randomUUID } from "node:crypto";
import { type Browser, type BrowserContext, type Page } from "@playwright/test";

export const API = "http://localhost:8080/api";
const PASSWORD = "TestPass1!";

export function uniqueUser(tag: string) {
  const ts = Date.now();
  return { email: `e2e.${tag}.${ts}@test.local`, username: `e2e${tag}${ts}` };
}

export async function signUp(page: Page, email: string, username: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Smith").fill("E2E User");
  await page.getByPlaceholder("janesmith").fill(username);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL("/");
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("/");
}

export async function createWorkspace(page: Page, name: string) {
  // Use aria-label selector — only the sidebar IconButton has it, not the dialog submit
  await page.locator('[aria-label="Create workspace"]').click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByPlaceholder("e.g. My Company").fill(name);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name }).waitFor();
}

export async function selectWorkspace(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}

export async function createChannel(page: Page, name: string) {
  await page.getByRole("button", { name: "Add channel" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. announcements").fill(name);
  await dialog.getByRole("button", { name: "Create channel" }).click();
  await page.getByRole("button", { name }).waitFor();
}

export async function selectChannel(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}

export async function sendMessage(page: Page, channelName: string, body: string) {
  await page.getByPlaceholder(`Message #${channelName}`).fill(body);
  await page.getByPlaceholder(`Message #${channelName}`).press("Enter");
}

/**
 * Resolves once the page sends a STOMP SUBSCRIBE to a destination starting with `destination`,
 * on a socket opened after this call.
 * Use it before a realtime assertion so the other user doesn't act before the subscription exists.
 */
export function waitForSubscription(page: Page, destination: string): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (ws) => {
      ws.on("framesent", (frame) => {
        const payload = typeof frame.payload === "string" ? frame.payload : frame.payload.toString();
        if (payload.startsWith("SUBSCRIBE") && payload.includes(`destination:${destination}`)) resolve();
      });
    });
  });
}

export interface TwoUsers {
  a: Page;
  b: Page;
  ctxA: BrowserContext;
  ctxB: BrowserContext;
  userA: { email: string; username: string };
  userB: { email: string; username: string };
  wsName: string;
  wsId: number;
  generalId: number;
  close: () => Promise<void>;
}

/**
 * Signs up user A (workspace owner) and user B in separate browser contexts, invites B as a MEMBER
 * and opens #general on both pages.
 */
export async function setupTwoUsersInWorkspace(browser: Browser, tag: string): Promise<TwoUsers> {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const userA = uniqueUser(`${tag}a`);
  const userB = uniqueUser(`${tag}b`);
  await signUp(a, userA.email, userA.username);
  await signUp(b, userB.email, userB.username);

  const wsName = `${tag}-${Date.now()}`;
  await createWorkspace(a, wsName);
  const workspaces = await (await a.request.get(`${API}/workspaces`)).json();
  const wsId: number = workspaces.find((w: { name: string }) => w.name === wsName).id;
  const invited = await a.request.post(`${API}/workspaces/${wsId}/members/invite`, {
    data: { identifier: userB.username },
  });
  if (!invited.ok()) throw new Error(`Inviting ${userB.username} failed with ${invited.status()}`);
  const channels = await (await a.request.get(`${API}/workspaces/${wsId}/channels`)).json();
  const generalId: number = channels.find((c: { name: string }) => c.name === "general").id;

  // B's workspace list was loaded before the invite.
  await b.reload();
  for (const page of [a, b]) {
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");
  }

  return {
    a, b, ctxA, ctxB, userA, userB, wsName, wsId, generalId,
    close: async () => {
      await ctxA.close();
      await ctxB.close();
    },
  };
}

/** Sets the plan directly on messaging-service (the gateway refuses /api/internal). */
export async function setWorkspacePlan(page: Page, wsId: number, plan: "FREE" | "PREMIUM") {
  const res = await page.request.patch(`http://localhost:8083/internal/workspaces/${wsId}/plan`, {
    headers: { "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN ?? "e2e-internal-token" },
    data: { plan },
  });
  if (!res.ok()) throw new Error(`Setting the plan failed with ${res.status()}`);
}

/** Posts a Stripe event to the public webhook, signed the way Stripe signs it. */
export async function sendStripeWebhook(page: Page, type: string, object: Record<string, unknown>) {
  const created = Math.floor(Date.now() / 1000);
  const id = `evt_e2e_${randomUUID()}`;
  const payload = JSON.stringify({ id, type, created, data: { object } });
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e";
  const signature = createHmac("sha256", secret).update(`${created}.${payload}`).digest("hex");
  const res = await page.request.post(`${API}/payments/webhook`, {
    headers: { "Stripe-Signature": `t=${created},v1=${signature}`, "Content-Type": "application/json" },
    data: payload,
  });
  if (!res.ok()) throw new Error(`The Stripe webhook failed with ${res.status()}`);
}

/**
 * Signs up one more user in a new browser context, has `owner` invite them as a MEMBER and opens
 * the workspace for them. Close the returned context yourself.
 */
export async function addUserToWorkspace(browser: Browser, owner: Page, wsId: number, wsName: string, tag: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = uniqueUser(tag);
  await signUp(page, user.email, user.username);
  const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
    data: { identifier: user.username },
  });
  if (!invited.ok()) throw new Error(`Inviting ${user.username} failed with ${invited.status()}`);
  await page.reload();
  await selectWorkspace(page, wsName);
  return { page, ctx, user };
}
