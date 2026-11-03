import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addChannelMember,
  browseChannels,
  joinChannel,
  leaveChannel,
  listChannelMembers,
  removeChannelMember,
} from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export const useBrowseChannels = (workspaceId: number, enabled: boolean) =>
  useQuery({
    queryKey: channelKeys.browse(workspaceId),
    queryFn: () => browseChannels(workspaceId),
    enabled,
  });

export function useJoinChannel(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: number) => joinChannel(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.byWorkspace(workspaceId) }),
  });
}

export function useLeaveChannel(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: number) => leaveChannel(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.byWorkspace(workspaceId) }),
  });
}

export const useChannelMembers = (channelId: number) =>
  useQuery({
    queryKey: channelKeys.members(channelId),
    queryFn: () => listChannelMembers(channelId),
  });

export function useAddChannelMember(channelId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => addChannelMember(channelId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.members(channelId) }),
  });
}

export function useRemoveChannelMember(channelId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => removeChannelMember(channelId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.members(channelId) }),
  });
}
