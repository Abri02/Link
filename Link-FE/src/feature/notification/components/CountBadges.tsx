import { Center, HStack, Text } from "@chakra-ui/react";
import { useNotificationStore } from "../stores/notificationStore";

const format = (n: number) => (n > 99 ? "99+" : String(n));

function Badge({ bg, color, label, children }: { bg: string; color: string; label: string; children: string }) {
  return (
    <Center bg={bg} borderRadius="full" minW="4.5" h="4.5" px="1" flexShrink={0} title={label}>
      <Text textStyle="caption" fontWeight="600" color={color}>
        {children}
      </Text>
    </Center>
  );
}

/** Sidebar badges for a channel or conversation: "@n" for unread mentions, then the unread count. */
export function CountBadges({ channelId }: { channelId: number }) {
  const unread = useNotificationStore((s) => s.unreadCounts[channelId] ?? 0);
  const mentions = useNotificationStore((s) => s.mentionCounts[channelId] ?? 0);
  if (unread === 0 && mentions === 0) return null;

  return (
    <HStack gap="1" flexShrink={0}>
      {mentions > 0 && (
        <Badge bg="fg.error" color="bg.panel" label={`${mentions} unread mention${mentions === 1 ? "" : "s"}`}>
          {`@${format(mentions)}`}
        </Badge>
      )}
      {unread > 0 && (
        <Badge bg="brand.solid" color="brand.contrast" label={`${unread} unread`}>
          {format(unread)}
        </Badge>
      )}
    </HStack>
  );
}
