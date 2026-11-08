import { test, expect, type Page } from "@playwright/test";
import { API, selectWorkspace, sendMessage, sendStripeWebhook, setupTwoUsersInWorkspace } from "./helpers";

const FRONTEND = "http://localhost:5173";
const MB = 1024 * 1024;

/** Answers a billing request the way payment-service does, with a URL instead of a real Stripe page. */
async function mockBillingSession(page: Page, path: string, url: string) {
  const requests: unknown[] = [];
  await page.route(`${API}/payments/${path}`, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
      body: JSON.stringify({ url }),
    });
  });
  return requests;
}

const completeCheckout = (page: Page, wsId: number, subscription: string) =>
  sendStripeWebhook(page, "checkout.session.completed", {
    mode: "subscription",
    payment_status: "paid",
    metadata: { workspaceId: String(wsId) },
    customer: `cus_${subscription}`,
    subscription,
  });

const uniqueSubscription = () => `sub_e2e_${Date.now()}`;

test.describe("Payments", () => {
  test("the owner upgrades through Checkout, and every member gets Premium", async ({ browser }) => {
    const { a, b, wsId, wsName, generalId, close } = await setupTwoUsersInWorkspace(browser, "payup");

    await a.getByRole("button", { name: "Billing" }).click();
    await expect(a.getByTestId("current-plan")).toHaveText("Free");
    await a.getByRole("link", { name: "Compare plans" }).click();
    await expect(a).toHaveURL(`/pricing?workspaceId=${wsId}`);
    await expect(a.getByRole("cell", { name: "Last 90 days" })).toBeVisible();

    const successUrl = `${FRONTEND}/billing/success?workspaceId=${wsId}`;
    const requests = await mockBillingSession(a, "checkout-session", successUrl);
    await a.getByRole("button", { name: "Upgrade to Premium" }).click();

    // Stripe sent the browser back, but the webhook hasn't arrived yet.
    await expect(a).toHaveURL(successUrl);
    expect(requests).toEqual([{ workspaceId: wsId }]);
    await expect(a.getByText("Confirming your payment…")).toBeVisible();

    await completeCheckout(a, wsId, uniqueSubscription());
    await expect(a.getByRole("heading", { name: "You're on Premium" })).toBeVisible();

    // The app reloaded on the way back from Stripe, and the workspace is selected again.
    await a.getByRole("button", { name: "Back to workspace" }).click();
    await expect(a.getByText("Premium", { exact: true })).toBeVisible();

    await b.reload();
    await selectWorkspace(b, wsName);
    await expect(b.getByText("Premium", { exact: true })).toBeVisible();

    // The webhook reached messaging-service and file-service sees the new plan.
    const upload = await a.request.post(`${API}/attachments`, {
      multipart: {
        file: { name: "big.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(6 * MB) },
        channelId: String(generalId),
      },
    });
    expect(upload.status()).toBe(201);

    await close();
  });

  test("a Premium owner can open the portal, and a cancelled subscription goes back to Free", async ({ browser }) => {
    const { a, wsId, wsName, close } = await setupTwoUsersInWorkspace(browser, "payportal");
    const subscription = uniqueSubscription();
    await completeCheckout(a, wsId, subscription);

    await a.reload();
    await selectWorkspace(a, wsName);
    await a.getByRole("button", { name: "Billing" }).click();
    await expect(a.getByTestId("current-plan")).toHaveText("Premium");

    const portalUrl = `${FRONTEND}/pricing?workspaceId=${wsId}&portal=1`;
    const requests = await mockBillingSession(a, "portal-session", portalUrl);
    await a.getByRole("button", { name: "Manage billing" }).click();
    await expect(a).toHaveURL(portalUrl);
    expect(requests).toEqual([{ workspaceId: wsId }]);

    await sendStripeWebhook(a, "customer.subscription.deleted", {
      id: subscription,
      metadata: { workspaceId: String(wsId) },
    });
    await a.reload();
    await expect(a.getByRole("button", { name: "Upgrade to Premium" })).toBeVisible();

    await close();
  });

  test("only the owner sees billing controls", async ({ browser }) => {
    const { b, wsId, close } = await setupTwoUsersInWorkspace(browser, "paymember");

    await expect(b.getByRole("button", { name: "Leave workspace" })).toBeVisible();
    await expect(b.getByRole("button", { name: "Billing" })).toHaveCount(0);

    await b.goto(`/pricing?workspaceId=${wsId}`);
    await expect(b.getByText("Only the workspace owner can upgrade this workspace.")).toBeVisible();
    await expect(b.getByRole("button", { name: "Upgrade to Premium" })).toHaveCount(0);

    await close();
  });

  test("the cancel page says nothing was charged", async ({ browser }) => {
    const { a, wsId, close } = await setupTwoUsersInWorkspace(browser, "paycancel");

    await a.goto(`/billing/cancel?workspaceId=${wsId}`);
    await expect(a.getByRole("heading", { name: "Checkout cancelled" })).toBeVisible();
    await a.getByRole("link", { name: "See plans" }).click();
    await expect(a).toHaveURL(`/pricing?workspaceId=${wsId}`);

    await close();
  });

  test("a billing error is shown to the owner", async ({ browser }) => {
    const { a, wsId, close } = await setupTwoUsersInWorkspace(browser, "payerror");

    await a.route(`${API}/payments/checkout-session`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
        body: JSON.stringify({ message: "Payments are not configured" }),
      })
    );
    await a.goto(`/pricing?workspaceId=${wsId}`);
    await a.getByRole("button", { name: "Upgrade to Premium" }).click();
    await expect(a.getByRole("alert")).toHaveText("Payments are not configured");

    await close();
  });
});

test.describe("Upsell", () => {
  test("an upload over the Free limit links to the pricing page", async ({ browser }) => {
    const { a, wsId, close } = await setupTwoUsersInWorkspace(browser, "upsellfile");

    await a.locator('input[type="file"]').setInputFiles({
      name: "big.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(6 * MB),
    });
    await a.getByRole("link", { name: "See Premium" }).click();
    await expect(a).toHaveURL(`/pricing?workspaceId=${wsId}`);

    await close();
  });

  test("the guest limit in the invite dialog links to the pricing page", async ({ browser }) => {
    const { a, userB, wsId, close } = await setupTwoUsersInWorkspace(browser, "upsellguest");

    // Only the refusal is mocked: plan-limits.spec.ts covers the real 402.
    await a.route(`${API}/workspaces/${wsId}/members/invite`, (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
        body: JSON.stringify({ message: "The Free plan allows at most 3 guests", code: "GUEST_LIMIT_REACHED" }),
      })
    );
    await a.getByRole("button", { name: "Invite member" }).click();
    await a.getByRole("dialog").getByPlaceholder("e.g. alice or alice@example.com").fill(userB.username);
    await a.getByRole("dialog").getByRole("button", { name: "Invite", exact: true }).click();
    await expect(a.getByText("The Free plan allows at most 3 guests")).toBeVisible();
    await expect(a.getByRole("link", { name: "See Premium" })).toHaveAttribute("href", `/pricing?workspaceId=${wsId}`);

    await close();
  });

  test("an old thread on Free links to the pricing page", async ({ browser }) => {
    const { a, generalId, wsId, close } = await setupTwoUsersInWorkspace(browser, "upsellthread");

    const body = `old root ${Date.now()}`;
    await sendMessage(a, "general", body);
    await expect(a.getByText(body)).toBeVisible();

    // Nothing in a test run is 90 days old, so the refusal is mocked.
    await a.route(new RegExp(`/api/channels/${generalId}/messages/\\d+/thread`), (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
        body: JSON.stringify({ message: "The Free plan shows the last 90 days of messages", code: "HISTORY_LIMIT_REACHED" }),
      })
    );
    await a.getByText(body).hover();
    await a.getByRole("button", { name: "Reply in thread" }).click();
    await expect(a.getByRole("dialog").getByRole("link", { name: "See Premium" }))
      .toHaveAttribute("href", `/pricing?workspaceId=${wsId}`, { timeout: 3_000 });

    await close();
  });
});
