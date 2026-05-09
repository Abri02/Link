import { HStack, Text } from "@chakra-ui/react";
import { Hash } from "lucide-react";
import type { Channel } from "../api/channel.types";

interface Props {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}

export function ChannelItem({ channel, isSelected, onClick }: Props) {
  return (
    <HStack
      as="button"
      onClick={onClick}
      w="full"
      px="12px"
      py="5px"
      borderRadius="6px"
      bg={isSelected ? "#1E1E2E" : "transparent"}
      color={isSelected ? "#F4F4F6" : "rgba(244,244,246,0.55)"}
      _hover={{ bg: "#1A1A28", color: "#F4F4F6" }}
      transition="all 0.1s"
      gap="6px"
      outline="none"
    >
      <Hash size={14} strokeWidth={1.5} />
      <Text fontSize="14px" fontWeight={isSelected ? "500" : "400"} truncate>
        {channel.name}
      </Text>
    </HStack>
  );
}
