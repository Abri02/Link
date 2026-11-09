import { chakra, HStack } from "@chakra-ui/react";
import { themeSwatchRecipe } from "@/theme/recipes";
import { THEMES, useThemeStore } from "@/theme/themeStore";

const Swatch = chakra("button", themeSwatchRecipe);

export function ThemePicker() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <HStack role="group" aria-label="Theme" gap="2">
      {THEMES.map((t) => (
        <Swatch
          key={t.id}
          type="button"
          // Scopes the --link-* variables so each swatch shows its own theme's accent.
          data-theme={t.id}
          aria-label={t.label}
          aria-pressed={theme === t.id}
          title={t.label}
          selected={theme === t.id}
          onClick={() => setTheme(t.id)}
        />
      ))}
    </HStack>
  );
}
