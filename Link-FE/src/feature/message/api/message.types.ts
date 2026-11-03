export interface Message {
  id: number;
  channelId: number;
  authorId: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  parentMessageId: number | null;
  reactions: Record<string, number[]>;
  replyCount: number;
  attachmentId: number | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  /** SYSTEM messages record conversation events (join, leave, rename). */
  type: "USER" | "SYSTEM";
}

export interface SendMessageRequest {
  body: string;
  parentMessageId?: number;
  attachmentId?: number;
  attachmentName?: string;
  attachmentMime?: string;
}
