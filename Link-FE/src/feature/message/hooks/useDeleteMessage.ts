import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMessage } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useDeleteMessage(channelId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: number) => deleteMessage(channelId, messageId),

    onSuccess: (_data, messageId) => {
      queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
        old?.filter((m) => m.id !== messageId)
      );
    },
  });
}
