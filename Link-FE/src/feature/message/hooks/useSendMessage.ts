import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessage } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";
import { appendMessage } from "../api/message.cache";
import type { Message, SendMessageRequest } from "../api/message.types";

export const useSendMessage = (channelId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: SendMessageRequest) => sendMessage(channelId, req),
    // Don't rely only on the STOMP broadcast: it is lost if the subscription isn't ready yet.
    onSuccess: (message) => {
      const key =
        message.parentMessageId == null
          ? messageKeys.byChannel(channelId)
          : messageKeys.thread(message.parentMessageId);
      queryClient.setQueryData<Message[]>(key, (old) => appendMessage(old, message));
    },
  });
};
