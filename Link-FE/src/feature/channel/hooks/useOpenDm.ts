import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDm } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export function useOpenDm(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: number) => openDm(workspaceId, { targetUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.dms(workspaceId) });
    },
  });
}
