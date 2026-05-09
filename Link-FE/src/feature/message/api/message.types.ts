export interface Message {
  id: number;
  channelId: number;
  authorId: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  parentMessageId: number | null;
}

export interface SendMessageRequest {
  body: string;
  parentMessageId?: number;
}
