import { create } from "zustand";

interface NotificationState {
  unreadCounts: Record<number, number>;
  increment: (channelId: number) => void;
  clear: (channelId: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCounts: {},
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
