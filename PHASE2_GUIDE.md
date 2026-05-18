# Phase 2 Implementation Guide — Rest of Semester 1

Remaining work after the Phase 1 demo. Each block is roughly 1–2 days. Tackle
them in this order because later blocks depend on earlier ones.

---

## 0. Finish Phase 1 demo prep (Days 20–21)

- [ ] `docker compose down -v && docker compose up` — verify clean boot.
- [ ] Run the acceptance checklist from README § 4.1 end-to-end.
- [ ] Record a short screen capture as backup.

---

## 1. Threads

**Goal:** Users can reply inside a message thread. A `Drawer` shows the thread
inline without leaving the channel.

### Backend

1. **Add `GET /messages/{id}/thread` endpoint** in `MessageController`.
   - Query: `messages.findByParentMessageId(parentId)` ordered by `createdAt ASC`.
   - Return `List<MessageResponse>`.
   - Auth check: caller must be a `ChannelMember` of the channel the parent
     message belongs to.
2. **`POST /channels/{id}/messages` already accepts `parentMessageId`** — no
   change needed, just confirm it persists and broadcasts correctly.
3. **WS broadcast for thread replies** — when `parentMessageId != null`, also
   publish to `/topic/thread.{parentMessageId}` so thread views update live.

### Frontend

4. **`useThreadMessages(parentId)` hook** — calls `GET /messages/{id}/thread`
   with TanStack Query. Key: `["thread", parentId]`.
5. **`useChannelSocket`** — subscribe to `/topic/thread.{parentId}` when a
   thread is open; append to the `["thread", parentId]` cache.
6. **`ThreadDrawer` component** — Chakra `Drawer` (slide-over from right).
   - Opens when user clicks a "Reply" button on a `MessageRow`.
   - Shows the parent message at the top, then replies below.
   - `MessageComposer` at the bottom sends with `parentMessageId` set.
7. **`MessageRow` — add "Reply" button** visible on hover (`_hover`).
   - Store selected thread parent in `workspaceStore.selectedThreadMessageId`.

### Checklist

- [ ] `GET /messages/{id}/thread` returns replies in order.
- [ ] Reply persists with correct `parent_message_id`.
- [ ] Second user sees new thread reply in real time.
- [ ] Thread drawer closes cleanly and unsubscribes from WS topic.

---

## 2. Reactions

**Goal:** Users can react to any message with an emoji. Reactions are shown as
aggregated pill buttons under the message body.

### Backend

1. **Flyway migration `V2__add_reactions.sql`**:
   ```sql
   SET search_path TO messaging;
   CREATE TABLE message_reaction (
       id         BIGSERIAL   PRIMARY KEY,
       message_id BIGINT      NOT NULL REFERENCES message(id) ON DELETE CASCADE,
       user_id    BIGINT      NOT NULL,
       emoji      VARCHAR(10) NOT NULL,
       UNIQUE (message_id, user_id, emoji)
   );
   ```
2. **`MessageReaction` JPA entity** in `messaging-service`.
3. **`MessageReactionRepository`** — `findByMessageId(id)`, `deleteByMessageIdAndUserIdAndEmoji`.
4. **`POST /messages/{id}/reactions/{emoji}`** — upsert (ignore duplicate). Broadcast
   `ReactionEvent(messageId, emoji, userId, delta=+1)` to `/topic/channel.{channelId}`.
5. **`DELETE /messages/{id}/reactions/{emoji}`** — delete row. Broadcast with `delta=-1`.
6. **Update `MessageResponse`** to include `reactions: Map<String, Int>` (emoji →
   count). Compute in `MessageController.list` and `send`.

### Frontend

7. **`message.types.ts`** — add `reactions: Record<string, number>` to `Message`.
8. **`useToggleReaction` hook** — calls `POST` or `DELETE` depending on whether
   the user already reacted. On success: invalidate `["messages", channelId]`.
9. **Reaction pills in `MessageRow`** — row of small `Button` components under
   the body. Show emoji + count. Clicking toggles.
10. **Emoji picker `Popover`** — a "+" `IconButton` opens a small grid of common
    emojis (👍 ❤️ 😂 🎉 🔥 😮 😢 👀 — hardcode 8 for now, no external lib needed).
11. **WS update** — `useChannelSocket` already appends raw `MessageResponse` to
    cache; make sure the reaction delta from `ReactionEvent` is also handled (or
    refetch on react action — simpler for MVP).

### Checklist

- [ ] React to a message; count increments.
- [ ] Reacting twice removes the reaction.
- [ ] Second browser sees reaction update without refresh.
- [ ] `MessageResponse` from list endpoint includes reaction counts.

---

## 3. Message Edit & Delete

**Goal:** Authors can correct or remove their own messages. Changes broadcast
over WebSocket so other clients update immediately.

### Backend

1. **`PATCH /messages/{id}`** — body `{ "body": "..." }`.
   - Check `message.authorId == callerId`.
   - Update `body`, set `editedAt = Instant.now()`.
   - Broadcast `MessageEditedEvent(id, channelId, newBody, editedAt)` to
     `/topic/channel.{channelId}`.
2. **`DELETE /messages/{id}`** (soft delete) — set `deletedAt = Instant.now()`.
   - Broadcast `MessageDeletedEvent(id, channelId)`.
   - `list` endpoint already filters `deletedAt IS NULL`.

### Frontend

3. **`useEditMessage` / `useDeleteMessage` hooks** calling the new endpoints.
4. **`MessageRow` hover menu** — three-dot `IconButton` (only shown when
   `message.authorId === currentUserId`). Opens a `Menu` with "Edit" and
   "Delete" items.
5. **Inline edit mode** — clicking "Edit" replaces the message body with a
   small `Input` pre-filled with current text. Enter saves, Escape cancels.
6. **WS handler in `useChannelSocket`** — detect `type: "edited"` /
   `type: "deleted"` on the channel topic and update the React Query cache.
   (Add a `type` discriminator to the broadcast payloads on the BE side.)

### Checklist

- [ ] Only the author sees the edit/delete menu.
- [ ] Edited message shows "(edited)" label.
- [ ] Deleted message shows "Message deleted" placeholder or is removed.
- [ ] Both changes visible in second browser without reload.

---

## 4. RBAC Enforcement Pass

**Goal:** Codify and enforce the role matrix. Guests cannot post; only
OWNER/ADMIN can manage channels and members.

### Backend

1. **Document the role matrix** in README § 4.2 (add a table).
2. **`WorkspaceMemberRepository`** — add `findRoleByWorkspaceIdAndUserId`.
3. **Add `@PreAuthorize` to each controller**:
   - `POST /workspaces/{id}/members` — already checks OWNER/ADMIN in code;
     move to `@PreAuthorize` or keep in service layer.
   - `POST /workspaces/{id}/channels` — OWNER/ADMIN only.
   - `DELETE /channels/{id}/messages/{msgId}` — author OR ADMIN/OWNER.
   - `POST /channels/{id}/messages` — MEMBER or above (not GUEST).
4. **Enable method security** in `SecurityConfig`: `@EnableMethodSecurity`.
5. **Guest flow**: workspace invite sets `role = GUEST`; GUEST can read
   channels and messages (`GET`) but `POST /messages` returns 403.

### Frontend

6. Hide the message composer from guests (check member role from
   `useWorkspaceMembers`).
7. Hide "Create channel" button for non-ADMIN/OWNER.

### Checklist

- [ ] GUEST user can read messages but cannot post.
- [ ] MEMBER cannot create channels.
- [ ] ADMIN can add members.
- [ ] OWNER can change roles.

---

## 5. Message Search

**Goal:** Users can search for messages by keyword within a channel.

### Backend

1. **Add `q` param to `GET /channels/{id}/messages`** (optional).
   - When present, add a `WHERE body ILIKE '%' || :q || '%'` clause (or use
     Postgres `to_tsvector` / `plainto_tsquery` for proper full-text).
   - Simple `ILIKE` is fine for semester 1 — leave Elasticsearch for semester 2.
2. **`MessageRepository`** — add `findByChannelIdAndBodyContainingIgnoreCase`.

### Frontend

3. **Search bar** in the message area header (Chakra `InputGroup` with a
   magnifier icon).
4. **`useMessageSearch(channelId, query)` hook** — only fires when `query.length >= 2`.
5. Show results in a dropdown/panel; clicking a result scrolls to or highlights
   the message.

### Checklist

- [ ] Searching "hello" returns messages containing "hello".
- [ ] Search is case-insensitive.
- [ ] Empty query shows all messages (normal view).

---

## 6. File Sharing (`file-service`)

**Goal:** Users can attach images and files to messages. Images show inline.

### Infrastructure

1. **Add MinIO to `infra/docker-compose.yml`**:
   ```yaml
   minio:
     image: minio/minio:latest
     command: server /data --console-address ":9001"
     ports: ["9000:9000", "9001:9001"]
     environment:
       MINIO_ROOT_USER: minioadmin
       MINIO_ROOT_PASSWORD: minioadmin
   ```
2. **Create bucket** `link-attachments` via MinIO init container or startup hook.

### `file-service` (new microservice)

3. **Create `Link-BE/file-service`** subproject in `settings.gradle.kts`.
4. Dependencies: `spring-boot-starter-web`, `shared-jwt`, `software.amazon.awssdk:s3`.
5. **`POST /files/upload-url`** — caller provides `filename` + `contentType`;
   service returns a presigned PUT URL (5-min TTL) and a `fileId` (UUID stored
   in a `file` table).
6. **`GET /files/{fileId}`** — returns a presigned GET URL (1-hour TTL).
7. **Add to gateway routes**: `/api/files/**` → file-service (port 8084).

### Messaging integration

8. **`attachment` table** — `V3__add_attachments.sql` in messaging-service:
   ```sql
   SET search_path TO messaging;
   CREATE TABLE attachment (
       id         BIGSERIAL PRIMARY KEY,
       message_id BIGINT    NOT NULL REFERENCES message(id) ON DELETE CASCADE,
       file_id    UUID      NOT NULL,
       filename   TEXT      NOT NULL,
       mime_type  TEXT      NOT NULL,
       size_bytes BIGINT    NOT NULL
   );
   ```
9. **`POST /channels/{id}/messages`** — accept optional `attachments: List<AttachmentRef>`.
   Persist `Attachment` rows. Include `attachments` in `MessageResponse`.

### Frontend

10. **Clip `IconButton` in `MessageComposer`** — opens a hidden `<input type="file">`.
11. **Upload flow**: `POST /api/files/upload-url` → PUT to presigned URL → include
    `fileId` in the send-message request.
12. **`AttachmentPreview` component** — if `mime_type.startsWith("image/")`, render
    `<Image>`; otherwise render a download link.

### Checklist

- [ ] User uploads an image; it appears inline in the message.
- [ ] Non-image file shows as a download link.
- [ ] Presigned URL expires after TTL (verify with MinIO console).
- [ ] File upload gatewayed correctly (cookie auth).

---

## 7. Tests

**Goal:** Each service has unit tests for domain logic and one integration test
for the happy-path controller. E2E covers new features.

### JUnit unit tests (per service)

- **`auth-service`**: `JwtSignerTest` (already exists?), `AuthServiceTest`
  (signup duplicate email throws; login wrong password throws).
- **`messaging-service`**: `WorkspaceServiceTest` (create workspace sets OWNER;
  slug collision handled); `MessageServiceTest` (blank body rejected; guest
  cannot post).
- **`file-service`**: `FileServiceTest` (presigned URL contains correct bucket/key).

### Spring Boot integration tests (per service, `@SpringBootTest`)

- **`auth-service`**: `AuthControllerTest` (already exists) — extend with refresh
  and logout happy-paths if not already covered.
- **`messaging-service`**: `WorkspaceControllerTest` / `ChannelControllerTest` /
  `MessageControllerTest` (already exist) — add reaction and thread endpoints.
- **`user-service`**: `UserControllerTest` (already exists).

Use `@Testcontainers` + `postgres:16-alpine` so tests run against a real DB.

### Playwright E2E

Existing specs: `auth.spec.ts`, `channel.spec.ts`, `message.spec.ts`,
`workspace.spec.ts`.

Add:
- `thread.spec.ts` — open thread, post reply, verify in second tab.
- `reaction.spec.ts` — react to message, count shows, toggle removes.
- `dm.spec.ts` — open DM with another user, send message, receive in real time.

### CI — expand existing workflows

- Add `file-service.yml` when the service lands.
- The `e2e.yml` already exists; make sure it runs the new specs.

---

## Order of attack (recommended)

| Week | Focus |
|------|-------|
| 1 | Threads (BE + FE) |
| 2 | Reactions + Edit/Delete |
| 3 | RBAC enforcement + search |
| 4 | File sharing (MinIO + file-service + FE) |
| 5 | Tests (unit + integration + E2E) + CI polish |
| Buffer | Thesis screenshots, README polish, final demo dry run |
