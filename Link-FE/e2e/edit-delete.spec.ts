import { test, expect } from "@playwright/test";
import { setupTwoUsersInWorkspace, sendMessage } from "./helpers";

test.describe("Edit and delete", () => {
  test("an edit shows (edited) and a delete removes the message, live for both users", async ({ browser }) => {
    const { a, b, close } = await setupTwoUsersInWorkspace(browser, "editdel");

    const original = `typo mesage ${Date.now()}`;
    await sendMessage(a, "general", original);
    await expect(b.getByText(original)).toBeVisible();

    // Edit: the edit input is focused when it opens.
    await a.getByText(original).hover();
    await a.getByRole("button", { name: "Message actions" }).click();
    await a.getByRole("menuitem", { name: "Edit" }).click();
    await expect(a.getByRole("button", { name: "Save" })).toBeVisible();
    const edited = `fixed message ${Date.now()}`;
    await a.keyboard.press("ControlOrMeta+a");
    await a.keyboard.type(edited);
    await a.keyboard.press("Enter");

    for (const page of [a, b]) {
      await expect(page.getByText(edited)).toBeVisible();
      await expect(page.getByText("(edited)")).toBeVisible();
      await expect(page.getByText(original)).toHaveCount(0);
    }

    // Delete
    await a.getByText(edited).hover();
    await a.getByRole("button", { name: "Message actions" }).click();
    await a.getByRole("menuitem", { name: "Delete" }).click();

    await expect(a.getByText(edited)).toHaveCount(0);
    await expect(b.getByText(edited)).toHaveCount(0);

    await close();
  });
});
