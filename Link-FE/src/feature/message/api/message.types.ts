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
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
}

export interface SendMessageRequest {
  body: string;
  parentMessageId?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
}
