export interface Channel {
  id: number;
  workspaceId: number;
  name: string;
  kind: "PUBLIC" | "PRIVATE" | "DM" | "GROUP_DM";
  createdBy: number;
  createdAt: string;
}

export interface CreateChannelRequest {
  name: string;
  kind?: "PUBLIC" | "PRIVATE";
}

export interface ConversationMember {
  userId: number;
  username: string;
}

/** A 1-on-1 DM or a group DM. `members` includes the current user. */
export interface Conversation {
  id: number;
  workspaceId: number;
  kind: "DM" | "GROUP_DM";
  title: string | null;
  members: ConversationMember[];
}

export interface OpenConversationRequest {
  userIds: number[];
  title?: string;
}

export interface ConversationEvent {
  type: "UPSERT" | "REMOVED";
  conversation: Conversation;
}

/** The other members, i.e. everyone except the current user. */
export const otherMembers = (c: Conversation, currentUserId: number | undefined) =>
  c.members.filter((m) => m.userId !== currentUserId);

/** Title for group DMs that have one, otherwise the other members' names. */
export const conversationName = (c: Conversation, currentUserId: number | undefined) =>
  c.title ?? (otherMembers(c, currentUserId).map((m) => m.username).join(", ") || "Just you");
