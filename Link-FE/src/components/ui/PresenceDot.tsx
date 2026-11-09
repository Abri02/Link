import { Box, type BoxProps } from "@chakra-ui/react";

export function PresenceDot({ online, ...props }: BoxProps & { online: boolean }) {
  return (
    <Box
      data-status={online ? "online" : "offline"}
      w="2"
      h="2"
      borderRadius="full"
      flexShrink={0}
      bg={online ? "status.online" : "status.offline"}
      {...props}
    />
  );
}
