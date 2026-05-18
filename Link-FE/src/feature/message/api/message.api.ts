import { apiClient } from "@/util/apiClient";
import type { Message, SendMessageRequest } from "./message.types";

export const listMessages = (channelId: number, before?: number): Promise<Message[]> => {
  const params = new URLSearchParams({ limit: "50" });
  if (before != null) params.set("before", String(before));
  return apiClient(`/channels/${channelId}/messages?${params}`);
};

export const searchMessages = (channelId: number, q: string): Promise<Message[]> => {
  const params = new URLSearchParams({ q, limit: "50" });
  return apiClient(`/channels/${channelId}/messages?${params}`);
};

export const addReaction = (messageId: number, emoji: string): Promise<void> =>
  apiClient(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "POST" });

export const removeReaction = (messageId: number, emoji: string): Promise<void> =>
  apiClient(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" });

export const sendMessage = (channelId: number, data: SendMessageRequest): Promise<Message> =>
  apiClient(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(data) });
