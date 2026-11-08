import type { ComponentProps } from "react";
import { IconAction } from "./IconAction";

/** IconAction coloured for the sidebar surface. */
export function SidebarAction(props: ComponentProps<typeof IconAction>) {
  return (
    <IconAction
      color="sidebar.muted"
      _hover={{ bg: "sidebar.hover", color: "sidebar.fg" }}
      focusRingColor="sidebar.fg"
      {...props}
    />
  );
}
