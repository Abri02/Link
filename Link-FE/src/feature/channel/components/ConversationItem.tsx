import { HStack, Box, Text } from "@chakra-ui/react";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useNotificationStore } from "@/feature/notification/stores/notificationStore";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { conversationName, otherMembers, type Conversation } from "../api/channel.types";

interface Props {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function Avatar({ username, stacked }: { username: string; stacked?: boolean }) {
  return (
    <Box
      w="20px"
      h="20px"
      borderRadius="4px"
      bg="#2E2E50"
      border={stacked ? "1.5px solid #1A1A2E" : undefined}
      display="flex"
      alignItems="center"
      justifyContent="center"
      position={stacked ? "absolute" : "relative"}
      top={stacked ? "6px" : undefined}
      left={stacked ? "8px" : undefined}
    >
      <Text fontSize="9px" fontWeight="700" color="#6C63FF">
        {username.slice(0, 2).toUpperCase()}
      </Text>
    </Box>
  );
}

/** Sidebar row for a DM (avatar + presence dot) or a group DM (two stacked avatars + member count). */
export function ConversationItem({ conversation, isSelected, onClick }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const others = otherMembers(conversation, currentUserId);
  const isGroup = conversation.kind === "GROUP_DM";
  const dmPartnerId = isGroup ? undefined : others[0]?.userId;
  const isOnline = usePresenceStore((s) => dmPartnerId != null && s.onlineIds.has(dmPartnerId));
  const unread = useNotificationStore((s) => s.unreadCounts[conversation.id] ?? 0);
  const name = conversationName(conversation, currentUserId);

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
      <Box position="relative" flexShrink={0} w={isGroup ? "28px" : "20px"} h={isGroup ? "26px" : "20px"} aria-hidden>
        <Avatar username={others[0]?.username ?? "?"} />
        {isGroup && others[1] && <Avatar username={others[1].username} stacked />}
        {!isGroup && (
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
        )}
      </Box>
      <Text fontSize="14px" fontWeight={isSelected || unread > 0 ? "600" : "400"} truncate flex="1" textAlign="left">
        {name}
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
