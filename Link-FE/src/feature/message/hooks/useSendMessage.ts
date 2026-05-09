import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessage } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";

export const useSendMessage = (channelId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(channelId, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageKeys.byChannel(channelId) }),
  });
};
