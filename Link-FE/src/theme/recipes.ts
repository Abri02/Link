import { defineRecipe, defineSlotRecipe } from "@chakra-ui/react";
import { dialogAnatomy, menuAnatomy } from "@chakra-ui/react/anatomy";

// These extend Chakra's own recipes: only the listed values change.

export const buttonRecipe = defineRecipe({
  base: { borderRadius: "l1" },
  variants: { size: { sm: {} } },
  defaultVariants: { size: "sm" },
});

export const inputRecipe = defineRecipe({
  base: { borderRadius: "l1" },
  variants: {
    size: { sm: {} },
    variant: {
      outline: { bg: "bg.panel", borderColor: "border", _focusVisible: { borderColor: "brand.solid" } },
    },
  },
  defaultVariants: { size: "sm" },
});

export const dialogRecipe = defineSlotRecipe({
  slots: dialogAnatomy.keys(),
  base: {
    backdrop: { bg: "overlay" },
    positioner: { px: "4" },
    content: { borderWidth: "1px", borderColor: "border", borderRadius: "l2" },
    header: { pb: "2" },
    title: { textStyle: "title" },
  },
  variants: { size: { xs: {} } },
  defaultVariants: { size: "xs" },
});

export const menuRecipe = defineSlotRecipe({
  slots: menuAnatomy.keys(),
  base: {
    content: { borderWidth: "1px", borderColor: "border", borderRadius: "l2" },
    item: {
      borderRadius: "l1",
      cursor: "pointer",
      "&[data-danger]": { color: "fg.error" },
    },
  },
  variants: {
    variant: { subtle: { item: { _highlighted: { bg: "bg.muted" } } } },
    size: { md: { item: { textStyle: "label" } } },
  },
});

export const navItemRecipe = defineRecipe({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2",
    w: "full",
    px: "3",
    py: "1",
    borderRadius: "l1",
    color: "sidebar.muted",
    textStyle: "body",
    textAlign: "start",
    cursor: "pointer",
    transition: "backgrounds",
    transitionDuration: "fast",
    outline: "none",
    focusVisibleRing: "inside",
    focusRingColor: "sidebar.fg",
    _hover: { bg: "sidebar.hover", color: "sidebar.fg" },
  },
  variants: {
    selected: {
      true: {
        bg: "sidebar.active",
        color: "sidebar.fg",
        fontWeight: "600",
        _hover: { bg: "sidebar.active" },
      },
    },
    unread: {
      true: { color: "sidebar.fg", fontWeight: "600" },
    },
  },
});
