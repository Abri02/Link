export interface Channel {
  id: number;
  workspaceId: number;
  name: string;
  kind: "PUBLIC" | "PRIVATE" | "DM" | "GROUP_DM";
  createdBy: number;
  createdAt: string;
}

/** The channel every workspace starts with. The backend doesn't let anyone leave it. */
export const DEFAULT_CHANNEL = "general";

export interface CreateChannelRequest {
  name: string;
  kind?: "PUBLIC" | "PRIVATE";
}

/** Sent on `/user/queue/channels` when the user joins, leaves, is added to or removed from a channel. */
export interface ChannelEvent {
  type: "UPSERT" | "REMOVED";
  channel: Channel;
}

export interface ChannelMember {
  userId: number;
  username: string;
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
