import { apiClient } from "@/util/apiClient";
import type { Channel, CreateChannelRequest } from "./channel.types";

export const listChannels = (workspaceId: number): Promise<Channel[]> =>
  apiClient(`/workspaces/${workspaceId}/channels`);

export const createChannel = (workspaceId: number, data: CreateChannelRequest): Promise<Channel> =>
  apiClient(`/workspaces/${workspaceId}/channels`, { method: "POST", body: JSON.stringify(data) });
