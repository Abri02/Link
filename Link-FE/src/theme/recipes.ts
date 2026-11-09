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

export const messageRowRecipe = defineRecipe({
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "2",
    px: "4",
    pt: "2",
    pb: "1",
    transition: "backgrounds",
    transitionDuration: "fast",
    _hover: { bg: "bg.subtle" },
  },
  variants: {
    // Lines up with the text column: px (4) + avatar (8) + gap (2).
    grouped: { true: { display: "block", pl: "14", pt: "0.5", pb: "0.5" } },
  },
});

export const reactionChipRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    h: "6",
    px: "1.5",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "l1",
    bg: "bg.panel",
    color: "fg",
    textStyle: "caption",
    cursor: "pointer",
    focusVisibleRing: "outside",
    _hover: { borderColor: "brand.solid" },
  },
  variants: {
    reacted: { true: { borderColor: "brand.solid", bg: "brand.subtle" } },
  },
});

export const inputBoxRecipe = defineRecipe({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "1",
    p: "1",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "l2",
    bg: "bg.panel",
    transition: "colors",
    transitionDuration: "fast",
    _hover: { borderColor: "border.emphasized" },
    _focusWithin: { borderColor: "brand.solid", _hover: { borderColor: "brand.solid" } },
  },
});

export const bareInputRecipe = defineRecipe({
  base: {
    flex: "1",
    minW: "0",
    h: "8",
    px: "1.5",
    bg: "transparent",
    color: "fg",
    textStyle: "body",
    outline: "none",
    _placeholder: { color: "fg.muted" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
  },
});

export const listRowRecipe = defineRecipe({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2",
    px: "1.5",
    py: "1",
    borderRadius: "l1",
    color: "fg",
    textStyle: "label",
    _hover: { bg: "bg.subtle" },
  },
});

export const callWindowRecipe = defineRecipe({
  base: {
    bg: "overlay.panel",
    color: "overlay.fg",
    borderWidth: "1px",
    borderColor: "overlay.border",
    borderRadius: "l2",
    boxShadow: "lg",
    overflow: "hidden",
  },
});

export const callControlRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    w: "8",
    h: "8",
    borderRadius: "l1",
    color: "overlay.fg",
    cursor: "pointer",
    focusVisibleRing: "outside",
    focusRingColor: "overlay.fg",
    _hover: { bg: "overlay.hover" },
  },
  variants: {
    tone: {
      danger: { color: "overlay.danger" },
      active: { color: "overlay.active" },
      hangup: { bg: "overlay.hangup", _hover: { bg: "overlay.hangupHover" } },
    },
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
