import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export function useConversations(workspaceId: number | null) {
  return useQuery({
    queryKey: channelKeys.conversations(workspaceId!),
    queryFn: () => listConversations(workspaceId!),
    enabled: workspaceId != null,
  });
}
