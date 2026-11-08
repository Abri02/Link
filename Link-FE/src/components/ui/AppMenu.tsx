import { useId, type ReactElement, type ReactNode } from "react";
import { Menu, Portal } from "@chakra-ui/react";

interface AppMenuProps {
  trigger: ReactElement;
  children: ReactNode;
}

export function AppMenu({ trigger, children }: AppMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>{children}</Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

interface AppMenuItemProps {
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function AppMenuItem({ icon, danger, onClick, children }: AppMenuItemProps) {
  const value = useId();
  return (
    <Menu.Item value={value} onClick={onClick} data-danger={danger ? "" : undefined}>
      {icon}
      {children}
    </Menu.Item>
  );
}
