import { HStack, Text } from "@chakra-ui/react";
import { Hash, Lock } from "lucide-react";
import { CountBadges } from "@/feature/notification/components/CountBadges";
import { useHasUnread } from "@/feature/notification/stores/notificationStore";
import type { Channel } from "../api/channel.types";

interface Props {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}

export function ChannelItem({ channel, isSelected, onClick }: Props) {
  const unread = useHasUnread(channel.id);

  return (
    <HStack
      as="button"
      onClick={onClick}
      w="full"
      px="12px"
      py="5px"
      borderRadius="6px"
      bg={isSelected ? "#2A2A48" : "transparent"}
      color={isSelected ? "#F4F4F6" : unread ? "#F4F4F6" : "rgba(244,244,246,0.55)"}
      _hover={{ bg: "#22223A", color: "#F4F4F6" }}
      transition="all 0.1s"
      gap="6px"
      outline="none"
    >
      {channel.kind === "PRIVATE" ? <Lock size={13} strokeWidth={1.5} /> : <Hash size={14} strokeWidth={1.5} />}
      <Text fontSize="14px" fontWeight={isSelected || unread ? "600" : "400"} truncate flex="1">
        {channel.name}
      </Text>
      {!isSelected && <CountBadges channelId={channel.id} />}
    </HStack>
  );
}
