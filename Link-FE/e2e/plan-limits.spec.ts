import { test, expect, type Page } from "@playwright/test";
import { API, selectWorkspace, setWorkspacePlan, setupTwoUsersInWorkspace, signUp, uniqueUser } from "./helpers";

// Fake camera and microphone, and auto-accept the permission prompt.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

const MB = 1024 * 1024;

const upload = (page: Page, channelId: number, bytes: number) =>
  page.request.post(`${API}/attachments`, {
    multipart: {
      file: { name: "file.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(bytes) },
      channelId: String(channelId),
    },
  });

test.describe("Plan limits", () => {
  test("upload size depends on the plan", async ({ browser }) => {
    const { a, wsId, generalId, close } = await setupTwoUsersInWorkspace(browser, "planfile");

    expect((await upload(a, generalId, 4 * MB)).status()).toBe(201);
    const tooLarge = await upload(a, generalId, 6 * MB);
    expect(tooLarge.status()).toBe(402);
    expect((await tooLarge.json()).code).toBe("FILE_TOO_LARGE_FOR_PLAN");

    await setWorkspacePlan(a, wsId, "PREMIUM");
    expect((await upload(a, generalId, 6 * MB)).status()).toBe(201);

    // Above the Premium limit no plan helps.
    const overMax = await upload(a, generalId, 21 * MB);
    expect(overMax.status()).toBe(413);
    expect((await overMax.json()).code).toBe("FILE_TOO_LARGE");

    await close();
  });

  test("a Free workspace can have 3 guests, Premium more", async ({ browser }) => {
    const { a, wsId, close } = await setupTwoUsersInWorkspace(browser, "planguest");

    const invite = async (index: number) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const user = uniqueUser(`planguest${index}`);
      await signUp(page, user.email, user.username);
      await ctx.close();
      return { username: user.username };
    };
    const inviteGuest = (username: string) =>
      a.request.post(`${API}/workspaces/${wsId}/members/invite`, { data: { identifier: username, role: "GUEST" } });

    for (const i of [1, 2, 3]) {
      const { username } = await invite(i);
      expect((await inviteGuest(username)).status()).toBe(201);
    }

    const { username: fourth } = await invite(4);
    const refused = await inviteGuest(fourth);
    expect(refused.status()).toBe(402);
    expect((await refused.json()).code).toBe("GUEST_LIMIT_REACHED");

    await setWorkspacePlan(a, wsId, "PREMIUM");
    expect((await inviteGuest(fourth)).status()).toBe(201);

    await close();
  });

  test("a call in a Free workspace ends with a Premium message", async ({ browser }) => {
    const { a, wsId, wsName, userB, close } = await setupTwoUsersInWorkspace(browser, "plancall");
    const members: { userId: number; username: string }[] =
      await (await a.request.get(`${API}/workspaces/${wsId}/members`)).json();
    const bId = members.find((m) => m.username === userB.username)!.userId;
    await a.request.post(`${API}/workspaces/${wsId}/dms`, { data: { userIds: [bId] } });
    await a.reload();
    await selectWorkspace(a, wsName);
    await a.getByText("DIRECT MESSAGES", { exact: true }).locator("..")
      .getByRole("button", { name: userB.username, exact: true }).click();

    // Retry while the call socket is still connecting.
    await expect(async () => {
      const start = a.getByRole("button", { name: "Start call" });
      if (await start.isEnabled()) await start.click();
      await expect(a.getByTestId("call-status")).toHaveText("Video calls need a Premium workspace", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await close();
  });
});
