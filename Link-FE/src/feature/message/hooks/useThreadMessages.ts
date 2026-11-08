import { useQuery } from "@tanstack/react-query";
import { isPlanLimitError } from "@/util/apiClient";
import { listThreadMessages } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";

export function useThreadMessages(channelId: number | null, parentMessageId: number | null) {
  return useQuery({
    queryKey: messageKeys.thread(parentMessageId!),
    queryFn: () => listThreadMessages(channelId!, parentMessageId!),
    enabled: channelId != null && parentMessageId != null,
    // A plan limit won't go away on retry.
    retry: (failures, error) => !isPlanLimitError(error) && failures < 3,
  });
}
