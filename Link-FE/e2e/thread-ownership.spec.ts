import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel, sendMessage } from "./helpers";

const API = "http://localhost:8080/api";

test.describe("Thread parent ownership", () => {
  test("a reply's parent and a thread's root must belong to the route's channel", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const member = await memberCtx.newPage();

    const ownerUser = uniqueUser("throwner");
    const memberUser = uniqueUser("thrmember");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(member, memberUser.email, memberUser.username);

    const wsName = `ThreadOwn-${Date.now()}`;
    await createWorkspace(owner, wsName);

    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const channels = await (await owner.request.get(`${API}/workspaces/${wsId}/channels`)).json();
    const generalId = channels.find((c: { name: string }) => c.name === "general").id;

    const secretRes = await owner.request.post(`${API}/workspaces/${wsId}/channels`, {
      data: { name: `secret-${Date.now()}`, kind: "PRIVATE" },
    });
    expect(secretRes.status()).toBe(201);
    const secretId = (await secretRes.json()).id;

    const secretMsg = await owner.request.post(`${API}/channels/${secretId}/messages`, {
      data: { body: "top secret root" },
    });
    expect(secretMsg.status()).toBe(201);
    const secretMsgId = (await secretMsg.json()).id;
    await owner.request.post(`${API}/channels/${secretId}/messages`, {
      data: { body: "top secret reply", parentMessageId: secretMsgId },
    });

    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: memberUser.username },
    });
    expect(invited.ok()).toBeTruthy();

    // The member is in #general only. Using a private channel's message id through #general must fail.
    const crossReply = await member.request.post(`${API}/channels/${generalId}/messages`, {
      data: { body: "sneaky", parentMessageId: secretMsgId },
    });
    expect(crossReply.status()).toBe(400);

    const missingParent = await member.request.post(`${API}/channels/${generalId}/messages`, {
      data: { body: "orphan", parentMessageId: 999_999_999 },
    });
    expect(missingParent.status()).toBe(400);

    const crossThread = await member.request.get(`${API}/channels/${generalId}/messages/${secretMsgId}/thread`);
    expect(crossThread.status()).toBe(404);
    expect(await crossThread.text()).not.toContain("top secret reply");

    // A valid thread in #general still works through the UI.
    await selectWorkspace(owner, wsName);
    await selectChannel(owner, "general");
    await sendMessage(owner, "general", "thread root");
    const root = owner.getByText("thread root");
    await expect(root).toBeVisible();
    await root.hover();
    await owner.getByRole("button", { name: "Reply in thread" }).click();
    await sendMessage(owner, "thread", "thread answer");
    await expect(owner.getByRole("dialog").getByText("thread answer")).toBeVisible();

    await ownerCtx.close();
    await memberCtx.close();
  });
});
