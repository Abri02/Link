export interface Channel {
  id: number;
  workspaceId: number;
  name: string;
  kind: "PUBLIC" | "PRIVATE" | "DM";
  createdBy: number;
  createdAt: string;
}

export interface CreateChannelRequest {
  name: string;
  kind?: "PUBLIC" | "PRIVATE";
}

export interface DmChannel {
  id: number;
  workspaceId: number;
  otherUserId: number;
  otherUsername: string;
}

export interface OpenDmRequest {
  targetUserId: number;
}
