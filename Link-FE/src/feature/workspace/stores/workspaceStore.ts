import { create } from "zustand";
import { useNotificationStore } from "@/feature/notification/stores/notificationStore";

interface WorkspaceState {
  selectedWorkspaceId: number | null;
  selectedChannelId: number | null;
  threadMessageId: number | null;
  selectWorkspace: (id: number) => void;
  selectChannel: (id: number) => void;
  openThread: (messageId: number) => void;
  closeThread: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedWorkspaceId: null,
  selectedChannelId: null,
  threadMessageId: null,
  selectWorkspace: (id) => set({ selectedWorkspaceId: id, selectedChannelId: null, threadMessageId: null }),
  selectChannel: (id) => {
    useNotificationStore.getState().clear(id);
    set({ selectedChannelId: id, threadMessageId: null });
  },
  openThread: (messageId) => set({ threadMessageId: messageId }),
  closeThread: () => set({ threadMessageId: null }),
}));
