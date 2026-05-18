import { useQuery } from "@tanstack/react-query";
import { listThreadMessages } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";

export function useThreadMessages(channelId: number | null, parentMessageId: number | null) {
  return useQuery({
    queryKey: messageKeys.thread(parentMessageId!),
    queryFn: () => listThreadMessages(channelId!, parentMessageId!),
    enabled: channelId != null && parentMessageId != null,
  });
}
