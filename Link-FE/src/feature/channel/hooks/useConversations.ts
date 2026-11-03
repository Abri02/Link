import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";
import { useNotificationStore } from "@/feature/notification/stores/notificationStore";

export function useConversations(workspaceId: number | null) {
  return useQuery({
    queryKey: channelKeys.conversations(workspaceId!),
    queryFn: async () => {
      const conversations = await listConversations(workspaceId!);
      useNotificationStore.getState().seed(conversations);
      return conversations;
    },
    enabled: workspaceId != null,
  });
}
