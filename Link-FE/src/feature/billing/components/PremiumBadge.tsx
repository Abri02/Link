import { Text } from "@chakra-ui/react";

export function PremiumBadge() {
  return (
    <Text
      flexShrink={0}
      bg="rgba(108,99,255,0.2)"
      color="#A8A3FF"
      fontSize="10px"
      fontWeight="600"
      px="6px"
      py="1px"
      borderRadius="full"
    >
      Premium
    </Text>
  );
}
