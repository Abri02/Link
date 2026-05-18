import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReaction, removeReaction } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useToggleReaction(channelId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji, hasReacted }: { messageId: number; emoji: string; hasReacted: boolean; currentUserId: number }) =>
      hasReacted ? removeReaction(messageId, emoji) : addReaction(messageId, emoji),

    onMutate: async ({ messageId, emoji, hasReacted, currentUserId }) => {
      await queryClient.cancelQueries({ queryKey: messageKeys.byChannel(channelId) });
      const previous = queryClient.getQueryData<Message[]>(messageKeys.byChannel(channelId));

      queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
        old?.map((m) => {
          if (m.id !== messageId) return m;
          const current = m.reactions[emoji] ?? [];
          const updated = { ...m.reactions };
          if (hasReacted) {
            const next = current.filter((id) => id !== currentUserId);
            if (next.length === 0) delete updated[emoji];
            else updated[emoji] = next;
          } else {
            updated[emoji] = [...current, currentUserId];
          }
          return { ...m, reactions: updated };
        })
      );

      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(messageKeys.byChannel(channelId), ctx.previous);
    },
  });
}
