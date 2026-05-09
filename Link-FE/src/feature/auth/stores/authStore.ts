import { create } from "zustand";
import type { MeResponse } from "../api/auth.types";

interface AuthState {
  user: MeResponse | null;
  setUser: (user: MeResponse) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
