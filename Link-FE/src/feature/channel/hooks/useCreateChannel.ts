import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export const useCreateChannel = (workspaceId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createChannel(workspaceId, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKeys.byWorkspace(workspaceId) }),
  });
};
