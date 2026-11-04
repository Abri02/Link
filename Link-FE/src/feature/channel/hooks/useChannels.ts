import { useQuery } from "@tanstack/react-query";
import { listChannels } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";
import { useNotificationStore } from "@/feature/notification/stores/notificationStore";

export const useChannels = (workspaceId: number | null) =>
  useQuery({
    queryKey: channelKeys.byWorkspace(workspaceId!),
    queryFn: async () => {
      const channels = await listChannels(workspaceId!);
      useNotificationStore.getState().seed(channels);
      return channels;
    },
    enabled: workspaceId != null,
    staleTime: 1000 * 30,
  });
