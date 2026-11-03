import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";
import type { CreateChannelRequest } from "../api/channel.types";

export const useCreateChannel = (workspaceId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChannelRequest) => createChannel(workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.byWorkspace(workspaceId) }),
  });
};
