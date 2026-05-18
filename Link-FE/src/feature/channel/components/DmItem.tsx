import { HStack, Box, Text } from "@chakra-ui/react";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useNotificationStore } from "@/feature/notification/stores/notificationStore";
import type { DmChannel } from "../api/channel.types";

interface Props {
  dm: DmChannel;
  isSelected: boolean;
  onClick: () => void;
}

export function DmItem({ dm, isSelected, onClick }: Props) {
  const isOnline = usePresenceStore((s) => s.onlineIds.has(dm.otherUserId));
  const unread = useNotificationStore((s) => s.unreadCounts[dm.id] ?? 0);

  return (
    <HStack
      as="button"
      onClick={onClick}
      w="full"
      px="12px"
      py="5px"
      borderRadius="6px"
      bg={isSelected ? "#2A2A48" : "transparent"}
      color={isSelected ? "#F4F4F6" : "rgba(244,244,246,0.55)"}
      _hover={{ bg: "#22223A", color: "#F4F4F6" }}
      transition="all 0.1s"
      gap="8px"
      outline="none"
    >
      <Box position="relative" flexShrink={0}>
        <Box
          w="20px"
          h="20px"
          borderRadius="4px"
          bg="#2E2E50"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="9px" fontWeight="700" color="#6C63FF">
            {dm.otherUsername.slice(0, 2).toUpperCase()}
          </Text>
        </Box>
        <Box
          position="absolute"
          bottom="-1px"
          right="-1px"
          w="7px"
          h="7px"
          borderRadius="full"
          bg={isOnline ? "#22C55E" : "rgba(244,244,246,0.15)"}
          border="1.5px solid #1A1A2E"
        />
      </Box>
      <Text fontSize="14px" fontWeight={isSelected || unread > 0 ? "600" : "400"} truncate flex="1">
        {dm.otherUsername}
      </Text>
      {unread > 0 && !isSelected && (
        <Box
          bg="#6C63FF"
          borderRadius="full"
          minW="18px"
          h="18px"
          px="5px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Text fontSize="11px" fontWeight="700" color="#F4F4F6" lineHeight="1">
            {unread > 99 ? "99+" : unread}
          </Text>
        </Box>
      )}
    </HStack>
  );
}
