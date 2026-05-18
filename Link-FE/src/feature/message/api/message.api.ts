import { apiClient } from "@/util/apiClient";
import { API_URL } from "@/util/constants";
import type { Message, SendMessageRequest } from "./message.types";

export interface AttachmentResponse {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export const uploadAttachment = async (file: File): Promise<AttachmentResponse> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/attachments`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

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

export const editMessage = (channelId: number, messageId: number, body: string): Promise<Message> =>
  apiClient(`/channels/${channelId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) });

export const deleteMessage = (channelId: number, messageId: number): Promise<void> =>
  apiClient(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });

export const sendMessage = (channelId: number, data: SendMessageRequest): Promise<Message> =>
  apiClient(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(data) });

export const listThreadMessages = (channelId: number, parentMessageId: number): Promise<Message[]> =>
  apiClient(`/channels/${channelId}/messages/${parentMessageId}/thread`);
