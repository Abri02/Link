import { Tooltip } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface Props {
  label: string;
  placement?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}

export function Tip({ label, placement = "right", children }: Props) {
  return (
    <Tooltip.Root positioning={{ placement }}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
