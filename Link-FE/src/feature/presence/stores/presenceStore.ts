import { create } from "zustand";

interface PresenceState {
  onlineIds: Set<number>;
  setOnline: (id: number) => void;
  setOffline: (id: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds: new Set(),
  setOnline: (id) => set((s) => ({ onlineIds: new Set([...s.onlineIds, id]) })),
  setOffline: (id) =>
    set((s) => {
      const next = new Set(s.onlineIds);
      next.delete(id);
      return { onlineIds: next };
    }),
}));
