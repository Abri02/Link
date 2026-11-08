import { Text } from "@chakra-ui/react";

export function PremiumBadge() {
  return (
    <Text flexShrink={0} bg="sidebar.active" color="sidebar.fg" textStyle="caption" px="1.5" borderRadius="full">
      Premium
    </Text>
  );
}
