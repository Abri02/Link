import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { API_URL, WS_URL } from "@/util/constants";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";

export function useNotificationSocket(userId: number | null) {
  useEffect(() => {
    if (userId == null) return;

    const { setOnline, setOffline, bulkSetOnline } = usePresenceStore.getState();
    const { increment } = useNotificationStore.getState();

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        // Seed full presence state so late joiners see everyone.
        fetch(`${API_URL}/presence/online`, { credentials: "include" })
          .then((r) => r.json())
          .then((ids: number[]) => bulkSetOnline(ids))
          .catch(() => {});

        // Mark ourselves online immediately.
        setOnline(userId);

        client.subscribe("/topic/presence", (frame) => {
          const event: { userId: number; online: boolean } = JSON.parse(frame.body);
          if (event.online) setOnline(event.userId);
          else setOffline(event.userId);
        });

        client.subscribe("/user/queue/notifications", (frame) => {
          const event: { channelId: number; authorId: number; bodyPreview: string } =
            JSON.parse(frame.body);
          const selectedChannelId = useWorkspaceStore.getState().selectedChannelId;
          if (event.channelId !== selectedChannelId) {
            increment(event.channelId);
          }
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [userId]);
}
