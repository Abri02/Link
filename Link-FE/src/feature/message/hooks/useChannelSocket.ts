import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "@/util/constants";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useChannelSocket(channelId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId == null) return;

    const { setOnline, setOffline } = usePresenceStore.getState();

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        // Mark ourselves online immediately — the server publishes our presence
        // event before we subscribe, so we'd miss it otherwise.
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId != null) setOnline(currentUserId);

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
