import { test, expect } from "@playwright/test";
import { uniqueUser, signUp, createWorkspace, selectWorkspace, selectChannel } from "./helpers";

const API = "http://localhost:8080/api";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

test.describe("Attachment access control", () => {
  test("only members of the attachment's channel can upload to it and download it", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const outsiderCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const member = await memberCtx.newPage();
    const outsider = await outsiderCtx.newPage();

    const ownerUser = uniqueUser("attowner");
    const memberUser = uniqueUser("attmember");
    const outsiderUser = uniqueUser("attout");
    await signUp(owner, ownerUser.email, ownerUser.username);
    await signUp(member, memberUser.email, memberUser.username);
    await signUp(outsider, outsiderUser.email, outsiderUser.username);

    const wsName = `Attach-${Date.now()}`;
    await createWorkspace(owner, wsName);

    const workspaces = await (await owner.request.get(`${API}/workspaces`)).json();
    const wsId = workspaces.find((w: { name: string }) => w.name === wsName).id;
    const channels = await (await owner.request.get(`${API}/workspaces/${wsId}/channels`)).json();
    const generalId = channels.find((c: { name: string }) => c.name === "general").id;

    // Owner uploads an image in #general through the UI. It renders inline.
    await selectWorkspace(owner, wsName);
    await selectChannel(owner, "general");
    const uploadDone = owner.waitForResponse(
      (r) => r.url().endsWith("/api/attachments") && r.request().method() === "POST"
    );
    await owner.locator('input[type="file"]').setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PNG });
    const uploadRes = await uploadDone;
    expect(uploadRes.status()).toBe(201);
    const generalAttachmentId = (await uploadRes.json()).id;
    await owner.getByPlaceholder("Message #general").press("Enter");
    const img = owner.getByRole("img", { name: "pixel.png" });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // Owner uploads a file into a private channel through the API.
    const secretRes = await owner.request.post(`${API}/workspaces/${wsId}/channels`, {
      data: { name: `secret-${Date.now()}`, kind: "PRIVATE" },
    });
    const secretId = (await secretRes.json()).id;
    const secretUpload = await owner.request.post(`${API}/attachments`, {
      multipart: {
        file: { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("top secret") },
        channelId: String(secretId),
      },
    });
    expect(secretUpload.status()).toBe(201);
    const secretAttachmentId = (await secretUpload.json()).id;

    const invited = await owner.request.post(`${API}/workspaces/${wsId}/members/invite`, {
      data: { identifier: memberUser.username },
    });
    expect(invited.ok()).toBeTruthy();

    // Member of #general: can download the #general file, not the private one.
    const memberGeneral = await member.request.get(`${API}/attachments/${generalAttachmentId}/content`);
    expect(memberGeneral.status()).toBe(200);
    const memberSecret = await member.request.get(`${API}/attachments/${secretAttachmentId}/content`);
    expect(memberSecret.status()).toBe(403);
    expect(await memberSecret.text()).not.toContain("top secret");

    // Member can't upload into the private channel.
    const memberSecretUpload = await member.request.post(`${API}/attachments`, {
      multipart: {
        file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
        channelId: String(secretId),
      },
    });
    expect(memberSecretUpload.status()).toBe(403);

    // Outsider (not in the workspace): no download, no upload.
    const outsiderGeneral = await outsider.request.get(`${API}/attachments/${generalAttachmentId}/content`);
    expect(outsiderGeneral.status()).toBe(403);
    const outsiderUpload = await outsider.request.post(`${API}/attachments`, {
      multipart: {
        file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
        channelId: String(generalId),
      },
    });
    expect(outsiderUpload.status()).toBe(403);

    await ownerCtx.close();
    await memberCtx.close();
    await outsiderCtx.close();
  });
});
