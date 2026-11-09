import { create } from "zustand";

// index.html repeats these ids and modes: its inline script runs before this bundle loads.
export const THEMES = [
  { id: "paper", label: "Paper", mode: "light" },
  { id: "harbor", label: "Harbor", mode: "light" },
  { id: "graphite", label: "Graphite", mode: "dark" },
  { id: "forest", label: "Forest", mode: "dark" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "link-theme";

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = id;
  root.classList.remove("light", "dark");
  root.classList.add(THEMES.find((t) => t.id === id)!.mode);
}

export const useThemeStore = create<ThemeState>((set) => ({
  // The inline script has already validated and applied the saved theme.
  theme: document.documentElement.dataset.theme as ThemeId,
  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be blocked. The theme still applies until the page reloads.
    }
    set({ theme });
  },
}));
