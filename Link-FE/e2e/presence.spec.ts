import { test, expect } from "@playwright/test";
import { setupTwoUsersInWorkspace, signIn } from "./helpers";

const ONLINE = "rgb(34, 197, 94)";
const OFFLINE = "rgba(244, 244, 246, 0.15)";

test.describe("Presence", () => {
  test("A sees B's dot go online when B logs in and offline when B closes the app", async ({ browser }) => {
    const { a, ctxB, userB, close } = await setupTwoUsersInWorkspace(browser, "presence");

    // The status dot is the first element inside B's row in A's member list.
    const bDot = a.getByRole("button", { name: userB.username, exact: true }).locator("div").first();
    await expect(bDot).toHaveCSS("background-color", ONLINE);

    await ctxB.close();
    await expect(bDot).toHaveCSS("background-color", OFFLINE);

    // B logs in again from a fresh browser.
    const ctxB2 = await browser.newContext();
    await signIn(await ctxB2.newPage(), userB.email);
    await expect(bDot).toHaveCSS("background-color", ONLINE);

    await ctxB2.close();
    await expect(bDot).toHaveCSS("background-color", OFFLINE);

    await close();
  });
});
