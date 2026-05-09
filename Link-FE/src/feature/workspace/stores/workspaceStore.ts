import { create } from "zustand";

interface WorkspaceState {
  selectedWorkspaceId: number | null;
  selectedChannelId: number | null;
  selectWorkspace: (id: number) => void;
  selectChannel: (id: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedWorkspaceId: null,
  selectedChannelId: null,
  selectWorkspace: (id) => set({ selectedWorkspaceId: id, selectedChannelId: null }),
  selectChannel: (id) => set({ selectedChannelId: id }),
}));
