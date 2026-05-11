import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/util/constants";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useChannelSocket(channelId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId == null) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/channel.${channelId}`, (frame) => {
          const message: Message = JSON.parse(frame.body);
          queryClient.setQueryData(
            messageKeys.byChannel(channelId),
            (old: Message[] | undefined) => (old ? [...old, message] : [message])
          );
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [channelId, queryClient]);
}
