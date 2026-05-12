import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL, WS_URL } from "@/util/constants";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useChannelSocket(channelId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId == null) return;

    const { setOnline, setOffline, bulkSetOnline } = usePresenceStore.getState();

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        // Seed current presence state — late joiners miss events broadcast before they subscribed.
        fetch(`${API_URL}/presence/online`, { credentials: "include" })
          .then((r) => r.json())
          .then((ids: number[]) => bulkSetOnline(ids))
          .catch(() => {});

        client.subscribe(`/topic/channel.${channelId}`, (frame) => {
          const message: Message = JSON.parse(frame.body);
          queryClient.setQueryData(
            messageKeys.byChannel(channelId),
            (old: Message[] | undefined) => (old ? [...old, message] : [message])
          );
        });

        client.subscribe("/topic/presence", (frame) => {
          const event: { userId: number; online: boolean } = JSON.parse(frame.body);
          if (event.online) setOnline(event.userId);
          else setOffline(event.userId);
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [channelId, queryClient]);
}
