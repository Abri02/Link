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
