import { useQuery } from "@tanstack/react-query";
import { listMessages } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";

export const useMessages = (channelId: number | null) =>
  useQuery({
    queryKey: messageKeys.byChannel(channelId!),
    queryFn: () => listMessages(channelId!),
    enabled: channelId != null,
    refetchInterval: 3000,
  });
