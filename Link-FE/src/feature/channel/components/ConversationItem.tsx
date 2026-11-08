import { Box, Center, Text } from "@chakra-ui/react";
import { NavItem } from "@/components/ui/NavItem";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { CountBadges } from "@/feature/notification/components/CountBadges";
import { useHasUnread } from "@/feature/notification/stores/notificationStore";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { conversationName, otherMembers, type Conversation } from "../api/channel.types";

interface Props {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function Avatar({ username, stacked }: { username: string; stacked?: boolean }) {
  return (
    <Center
      w="6"
      h="6"
      borderRadius="l1"
      bg="sidebar.active"
      borderWidth={stacked ? "1px" : undefined}
      borderColor="sidebar.bg"
      position={stacked ? "absolute" : "relative"}
      top={stacked ? "2" : undefined}
      left={stacked ? "2" : undefined}
    >
      <Text textStyle="caption" fontWeight="600" color="sidebar.fg">
        {username.slice(0, 2).toUpperCase()}
      </Text>
    </Center>
  );
}

/** Sidebar row for a DM (avatar + presence dot) or a group DM (two stacked avatars + member count). */
export function ConversationItem({ conversation, isSelected, onClick }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const others = otherMembers(conversation, currentUserId);
  const isGroup = conversation.kind === "GROUP_DM";
  const dmPartnerId = isGroup ? undefined : others[0]?.userId;
  const isOnline = usePresenceStore((s) => dmPartnerId != null && s.onlineIds.has(dmPartnerId));
  const unread = useHasUnread(conversation.id);

  return (
    <NavItem
      onClick={onClick}
      selected={isSelected}
      unread={unread}
      icon={
        <Box position="relative" flexShrink={0} w={isGroup ? "8" : "6"} h={isGroup ? "8" : "6"} aria-hidden>
          <Avatar username={others[0]?.username ?? "?"} />
          {isGroup && others[1] && <Avatar username={others[1].username} stacked />}
          {!isGroup && (
            <PresenceDot online={isOnline} position="absolute" bottom="-1px" right="-1px" outline="1px solid" outlineColor="sidebar.bg" />
          )}
        </Box>
      }
      trailing={!isSelected && <CountBadges channelId={conversation.id} />}
    >
      {conversationName(conversation, currentUserId)}
    </NavItem>
  );
}
