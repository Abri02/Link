import { useQuery } from "@tanstack/react-query";
import { listDms } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export function useDms(workspaceId: number | null) {
  return useQuery({
    queryKey: channelKeys.dms(workspaceId!),
    queryFn: () => listDms(workspaceId!),
    enabled: workspaceId != null,
  });
}
