import { Box, HStack, Text } from "@chakra-ui/react";
import { useNotificationStore } from "../stores/notificationStore";

const format = (n: number) => (n > 99 ? "99+" : String(n));

function Badge({ bg, label, children }: { bg: string; label: string; children: string }) {
  return (
    <Box
      bg={bg}
      borderRadius="full"
      minW="18px"
      h="18px"
      px="5px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      title={label}
    >
      <Text fontSize="11px" fontWeight="700" color="#F4F4F6" lineHeight="1">
        {children}
      </Text>
    </Box>
  );
}

/** Sidebar badges for a channel or conversation: "@n" for unread mentions, then the unread count. */
export function CountBadges({ channelId }: { channelId: number }) {
  const unread = useNotificationStore((s) => s.unreadCounts[channelId] ?? 0);
  const mentions = useNotificationStore((s) => s.mentionCounts[channelId] ?? 0);
  if (unread === 0 && mentions === 0) return null;

  return (
    <HStack gap="4px" flexShrink={0}>
      {mentions > 0 && (
        <Badge bg="#EF4444" label={`${mentions} unread mention${mentions === 1 ? "" : "s"}`}>
          {`@${format(mentions)}`}
        </Badge>
      )}
      {unread > 0 && (
        <Badge bg="#6C63FF" label={`${unread} unread`}>
          {format(unread)}
        </Badge>
      )}
    </HStack>
  );
}
