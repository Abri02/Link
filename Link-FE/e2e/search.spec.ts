import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

test.describe("Search", () => {
  test("search finds matching messages regardless of case", async ({ page }) => {
    const user = uniqueUser("search");
    await signUp(page, user.email, user.username);
    const wsName = `Search-${Date.now()}`;
    await createWorkspace(page, wsName);
    await selectWorkspace(page, wsName);
    await selectChannel(page, "general");

    const ts = Date.now();
    const hit = `Quarterly Report ${ts} is ready`;
    const miss = `Lunch plans ${ts}`;
    await sendMessage(page, "general", hit);
    await expect(page.getByText(hit)).toBeVisible();
    await sendMessage(page, "general", miss);
    await expect(page.getByText(miss)).toBeVisible();

    const search = page.getByPlaceholder("Search messages…");
    await search.fill("qUARTERLY rePORT");
    await expect(page.getByText(`1 result for "qUARTERLY rePORT"`)).toBeVisible();
    await expect(page.getByText(hit)).toBeVisible();
    await expect(page.getByText(miss)).toHaveCount(0);

    await search.fill("no such words here");
    await expect(page.getByText(`0 results for "no such words here"`)).toBeVisible();
    await expect(page.getByText(hit)).toHaveCount(0);

    // Clearing the search brings the full timeline back.
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByText(hit)).toBeVisible();
    await expect(page.getByText(miss)).toBeVisible();
  });
});
