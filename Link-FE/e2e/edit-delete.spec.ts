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

  test("message actions appear on keyboard focus", async ({ browser }) => {
    const { a, close } = await setupTwoUsersInWorkspace(browser, "editkbd");

    const body = `keyboard ${Date.now()}`;
    await sendMessage(a, "general", body);
    await a.mouse.move(0, 0);
    await expect(a.getByRole("button", { name: "Reply in thread" })).toHaveCount(0);

    // Back from the composer: the attach button, then the last control in the message row.
    const composer = a.getByPlaceholder("Message #general");
    await expect(composer).toBeEnabled();
    await composer.focus();
    await expect(composer).toBeFocused();
    await a.keyboard.press("Shift+Tab");
    await a.keyboard.press("Shift+Tab");
    await expect(a.getByRole("button", { name: "Add reaction" })).toBeFocused();

    await expect(a.getByRole("button", { name: "Reply in thread" })).toBeVisible();
    await a.keyboard.press("Tab");
    await expect(a.getByRole("button", { name: "Reply in thread" })).toBeFocused();

    // The menu is portalled out of the row, so opening it must not hide the actions.
    await a.keyboard.press("Tab");
    await a.keyboard.press("Enter");
    await expect(a.getByRole("menu", { name: "Message actions" })).toBeFocused();
    await expect(a.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await a.keyboard.press("Escape");
    await expect(a.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);

    await close();
  });
});
