import { create } from "zustand";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";

/**
 * Unread and @mention badge counts per channel id. Seeded from the server (channel and DM list
 * responses) and bumped live by `/user/queue/notifications`.
 */
interface NotificationState {
  unreadCounts: Record<number, number>;
  mentionCounts: Record<number, number>;
  /** Replaces the counts of these channels with the server's values. */
  seed: (items: { id: number; unreadCount: number; mentionCount: number }[]) => void;
  /** `unread`: a new top-level message. `mention`: the message @mentions the user. */
  increment: (channelId: number, kind: { unread: boolean; mention: boolean }) => void;
  clear: (channelId: number) => void;
}

const bump = (counts: Record<number, number>, id: number) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 });

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCounts: {},
  mentionCounts: {},
  seed: (items) =>
    set((s) => {
      // The open channel is being read right now, so a count fetched mid-read doesn't count.
      const selectedId = useWorkspaceStore.getState().selectedChannelId;
      const unreadCounts = { ...s.unreadCounts };
      const mentionCounts = { ...s.mentionCounts };
      for (const { id, unreadCount, mentionCount } of items) {
        if (unreadCount > 0 && id !== selectedId) unreadCounts[id] = unreadCount;
        else delete unreadCounts[id];
        if (mentionCount > 0 && id !== selectedId) mentionCounts[id] = mentionCount;
        else delete mentionCounts[id];
      }
      return { unreadCounts, mentionCounts };
    }),
  increment: (channelId, { unread, mention }) =>
    set((s) => ({
      unreadCounts: unread ? bump(s.unreadCounts, channelId) : s.unreadCounts,
      mentionCounts: mention ? bump(s.mentionCounts, channelId) : s.mentionCounts,
    })),
  clear: (channelId) =>
    set((s) => {
      const unreadCounts = { ...s.unreadCounts };
      const mentionCounts = { ...s.mentionCounts };
      delete unreadCounts[channelId];
      delete mentionCounts[channelId];
      return { unreadCounts, mentionCounts };
    }),
}));

/** True when the channel has unread messages or mentions, for bold sidebar names. */
export const useHasUnread = (channelId: number) =>
  useNotificationStore((s) => (s.unreadCounts[channelId] ?? 0) + (s.mentionCounts[channelId] ?? 0) > 0);
