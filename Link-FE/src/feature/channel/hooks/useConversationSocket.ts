import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "@/util/constants";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { channelKeys } from "../api/channel.api.keys";
import type { Channel, ChannelEvent, Conversation, ConversationEvent } from "../api/channel.types";

/**
 * Keeps the sidebar live over one per-user connection:
 * - conversations: someone opened a DM with us, added us to a group DM, renamed it, or someone
 *   (including us, in another tab) left it.
 * - channels: we joined or left a channel (maybe in another tab), or were added to or removed
 *   from a private channel.
 */
export function useConversationSocket(userId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId == null) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/user/queue/conversations", (frame) => {
          const { type, conversation }: ConversationEvent = JSON.parse(frame.body);
          const key = channelKeys.conversations(conversation.workspaceId);
          queryClient.setQueryData<Conversation[]>(key, (old) => {
            if (!old) return old;
            if (type === "REMOVED") return old.filter((c) => c.id !== conversation.id);
            return old.some((c) => c.id === conversation.id)
              ? old.map((c) => (c.id === conversation.id ? conversation : c))
              : [...old, conversation];
          });
          if (type === "REMOVED" && useWorkspaceStore.getState().selectedChannelId === conversation.id) {
            useWorkspaceStore.getState().clearChannel();
          }
        });
        client.subscribe("/user/queue/channels", (frame) => {
          const { type, channel }: ChannelEvent = JSON.parse(frame.body);
          queryClient.setQueryData<Channel[]>(channelKeys.byWorkspace(channel.workspaceId), (old) => {
            if (!old) return old;
            if (type === "REMOVED") return old.filter((c) => c.id !== channel.id);
            return old.some((c) => c.id === channel.id) ? old : [...old, channel].sort((a, b) => a.id - b.id);
          });
          queryClient.invalidateQueries({ queryKey: channelKeys.browse(channel.workspaceId) });
          if (type === "REMOVED" && useWorkspaceStore.getState().selectedChannelId === channel.id) {
            useWorkspaceStore.getState().clearChannel();
          }
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [userId, queryClient]);
}
