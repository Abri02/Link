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
        <Tooltip.Content
          bg="#22223A"
          color="#F4F4F6"
          fontSize="12px"
          px="8px"
          py="4px"
          borderRadius="6px"
          border="1px solid #3A3A60"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
