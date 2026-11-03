import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openConversation } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";
import type { OpenConversationRequest } from "../api/channel.types";

/** Opens a DM (one user) or group DM (2–8 users). Returns the existing one for the same people. */
export function useOpenConversation(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: OpenConversationRequest) => openConversation(workspaceId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.conversations(workspaceId) });
    },
  });
}
