import { apiClient } from "@/util/apiClient";
import type { Channel, CreateChannelRequest, DmChannel, OpenDmRequest } from "./channel.types";

export const listChannels = (workspaceId: number): Promise<Channel[]> =>
  apiClient(`/workspaces/${workspaceId}/channels`);

export const createChannel = (workspaceId: number, data: CreateChannelRequest): Promise<Channel> =>
  apiClient(`/workspaces/${workspaceId}/channels`, { method: "POST", body: JSON.stringify(data) });

export const listDms = (workspaceId: number): Promise<DmChannel[]> =>
  apiClient(`/workspaces/${workspaceId}/dms`);

export const openDm = (workspaceId: number, data: OpenDmRequest): Promise<DmChannel> =>
  apiClient(`/workspaces/${workspaceId}/dms`, { method: "POST", body: JSON.stringify(data) });
