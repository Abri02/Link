import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { buttonRecipe, dialogRecipe, inputRecipe, menuRecipe } from "./recipes";
import { textStyles } from "./text-styles";

const link = (name: string) => ({ value: `var(--link-${name})` });

const config = defineConfig({
  globalCss: {
    html: { colorPalette: "brand" },
    "input[type=checkbox]": { accentColor: "brand.solid" },
  },
  theme: {
    textStyles,
    recipes: { button: buttonRecipe, input: inputRecipe },
    slotRecipes: { dialog: dialogRecipe, menu: menuRecipe },
    tokens: {
      fonts: {
        heading: { value: "'Figtree Variable', sans-serif" },
        body: { value: "'Figtree Variable', sans-serif" },
        display: { value: "'Fraunces Variable', serif" },
      },
    },
    semanticTokens: {
      radii: {
        l1: { value: "6px" },
        l2: { value: "10px" },
        l3: { value: "10px" },
      },
      colors: {
        bg: {
          DEFAULT: link("canvas"),
          panel: link("panel"),
          subtle: link("bg-subtle"),
          muted: link("bg-muted"),
        },
        fg: {
          DEFAULT: link("text"),
          muted: link("muted"),
          subtle: link("muted"),
          error: link("danger"),
        },
        border: {
          DEFAULT: link("border"),
          emphasized: link("border-emphasized"),
        },
        brand: {
          solid: link("accent"),
          contrast: link("on-accent"),
          fg: link("accent"),
          muted: link("accent-muted"),
          subtle: link("accent-subtle"),
          emphasized: link("accent-emphasized"),
          focusRing: link("accent"),
        },
        sidebar: {
          bg: link("sidebar"),
          fg: link("sidebar-text"),
          muted: link("sidebar-muted"),
          hover: link("sidebar-hover"),
          active: link("sidebar-active"),
          border: link("sidebar-border"),
        },
        status: {
          online: link("online"),
          offline: link("offline"),
        },
        mention: {
          bg: link("mention-bg"),
          fg: link("mention-fg"),
        },
        overlay: link("overlay"),
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
