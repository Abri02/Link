import { apiClient } from "@/util/apiClient";
import type { Channel, Conversation, CreateChannelRequest, OpenConversationRequest } from "./channel.types";

export const listChannels = (workspaceId: number): Promise<Channel[]> =>
  apiClient(`/workspaces/${workspaceId}/channels`);

export const createChannel = (workspaceId: number, data: CreateChannelRequest): Promise<Channel> =>
  apiClient(`/workspaces/${workspaceId}/channels`, { method: "POST", body: JSON.stringify(data) });

export const listConversations = (workspaceId: number): Promise<Conversation[]> =>
  apiClient(`/workspaces/${workspaceId}/dms`);

export const openConversation = (workspaceId: number, data: OpenConversationRequest): Promise<Conversation> =>
  apiClient(`/workspaces/${workspaceId}/dms`, { method: "POST", body: JSON.stringify(data) });

/** Adding people to a 1-on-1 returns a new group DM. */
export const addConversationMembers = (conversationId: number, userIds: number[]): Promise<Conversation> =>
  apiClient(`/dms/${conversationId}/members`, { method: "POST", body: JSON.stringify({ userIds }) });

export const leaveConversation = (conversationId: number): Promise<void> =>
  apiClient(`/dms/${conversationId}/members/me`, { method: "DELETE" });

export const renameConversation = (conversationId: number, title: string): Promise<Conversation> =>
  apiClient(`/dms/${conversationId}`, { method: "PATCH", body: JSON.stringify({ title }) });
