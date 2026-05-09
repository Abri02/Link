import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace } from "./helpers";

test.describe("Workspace", () => {
  test("created workspace appears in the sidebar", async ({ page }) => {
    const user = uniqueUser("ws");
    await signUp(page, user.email, user.username);

    const name = `Workspace-${Date.now()}`;
    await createWorkspace(page, name);

    await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("new workspace auto-creates a #general channel", async ({ page }) => {
    const user = uniqueUser("wsgen");
    await signUp(page, user.email, user.username);

    const name = `GenWS-${Date.now()}`;
    await createWorkspace(page, name);
    await selectWorkspace(page, name);

    await expect(page.getByRole("button", { name: "general" })).toBeVisible();
  });

  test("switching workspaces updates the channel sidebar", async ({ page }) => {
    const user = uniqueUser("wsswitch");
    await signUp(page, user.email, user.username);

    const ts = Date.now();
    const alpha = `Alpha-${ts}`;
    const beta = `Beta-${ts}`;

    await createWorkspace(page, alpha);
    await createWorkspace(page, beta);

    // Both workspaces appear in the sidebar
    await expect(page.getByRole("button", { name: alpha })).toBeVisible();
    await expect(page.getByRole("button", { name: beta })).toBeVisible();

    // Select Alpha — channel sidebar shows its name
    await selectWorkspace(page, alpha);
    await expect(page.getByText(alpha)).toBeVisible();

    // Select Beta — channel sidebar updates
    await selectWorkspace(page, beta);
    await expect(page.getByText(beta)).toBeVisible();
  });
});
