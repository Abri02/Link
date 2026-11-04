import { create } from "zustand";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";

/**
 * Unread badge counts per channel id. Seeded from the server (channel and DM list responses)
 * and bumped live by `/user/queue/notifications`.
 */
interface NotificationState {
  unreadCounts: Record<number, number>;
  /** Replaces the counts of these channels with the server's values. */
  seed: (items: { id: number; unreadCount: number }[]) => void;
  increment: (channelId: number) => void;
  clear: (channelId: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCounts: {},
  seed: (items) =>
    set((s) => {
      // The open channel is being read right now, so a count fetched mid-read doesn't count.
      const selectedId = useWorkspaceStore.getState().selectedChannelId;
      const next = { ...s.unreadCounts };
      for (const { id, unreadCount } of items) {
        if (unreadCount > 0 && id !== selectedId) next[id] = unreadCount;
        else delete next[id];
      }
      return { unreadCounts: next };
    }),
  increment: (channelId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [channelId]: (s.unreadCounts[channelId] ?? 0) + 1,
      },
    })),
  clear: (channelId) =>
    set((s) => {
      const next = { ...s.unreadCounts };
      delete next[channelId];
      return { unreadCounts: next };
    }),
}));
