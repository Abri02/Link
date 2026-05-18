import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editMessage } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useEditMessage(channelId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: number; body: string }) =>
      editMessage(channelId, messageId, body),

    onSuccess: (updated) => {
      queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m))
      );
    },
  });
}
