import { Center, Icon, Text } from "@chakra-ui/react";
import type { ElementType, ReactNode } from "react";

interface Props {
  icon?: ElementType;
  children: ReactNode;
}

/** Centered message for a main-area view with nothing to show. */
export function EmptyState({ icon, children }: Props) {
  return (
    <Center flex="1" h="full" flexDirection="column" gap="2" p="6" textAlign="center">
      {icon && <Icon as={icon} boxSize="8" color="fg.muted" />}
      <Text textStyle="body" color="fg.muted">
        {children}
      </Text>
    </Center>
  );
}
