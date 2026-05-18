import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "@/util/constants";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

interface ReactionUpdateEvent {
  messageId: number;
  channelId: number;
  reactions: Record<string, number[]>;
}

export function useChannelSocket(channelId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId == null) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/channel.${channelId}`, (frame) => {
          const message: Message = JSON.parse(frame.body);
          queryClient.setQueryData(
            messageKeys.byChannel(channelId),
            (old: Message[] | undefined) => (old ? [...old, message] : [message])
          );
        });

        client.subscribe(`/topic/reactions.${channelId}`, (frame) => {
          const event: ReactionUpdateEvent = JSON.parse(frame.body);
          queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
            old?.map((m) =>
              m.id === event.messageId ? { ...m, reactions: event.reactions } : m
            )
          );
        });

        client.subscribe(`/topic/channel.${channelId}.edits`, (frame) => {
          const updated: Message = JSON.parse(frame.body);
          queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
            old?.map((m) => (m.id === updated.id ? updated : m))
          );
        });

        client.subscribe(`/topic/channel.${channelId}.deletes`, (frame) => {
          const { messageId }: { messageId: number } = JSON.parse(frame.body);
          queryClient.setQueryData<Message[]>(messageKeys.byChannel(channelId), (old) =>
            old?.filter((m) => m.id !== messageId)
          );
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [channelId, queryClient]);
}
