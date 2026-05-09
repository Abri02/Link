import { useQuery } from "@tanstack/react-query";
import { listChannels } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export const useChannels = (workspaceId: number | null) =>
  useQuery({
    queryKey: channelKeys.byWorkspace(workspaceId!),
    queryFn: () => listChannels(workspaceId!),
    enabled: workspaceId != null,
    staleTime: 1000 * 30,
  });
