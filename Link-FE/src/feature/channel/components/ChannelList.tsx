import { Box, VStack, HStack, Text, Spinner, IconButton } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import type { Channel } from "../api/channel.types";
import { ChannelItem } from "./ChannelItem";

interface Props {
  channels: Channel[] | undefined;
  isLoading: boolean;
  selectedChannelId: number | null;
  onSelect: (id: number) => void;
  onAddClick: () => void;
}

export function ChannelList({ channels, isLoading, selectedChannelId, onSelect, onAddClick }: Props) {
  return (
    <Box flex="1" overflow="auto" py="8px">
      <HStack px="12px" py="4px" mb="2px">
        <Text color="rgba(244,244,246,0.4)" fontSize="11px" fontWeight="600" letterSpacing="0.06em" flex="1">
          CHANNELS
        </Text>
        <IconButton
          size="xs"
          variant="ghost"
          color="rgba(244,244,246,0.4)"
          _hover={{ color: "#F4F4F6" }}
          aria-label="Add channel"
          onClick={onAddClick}
          h="20px"
          w="20px"
          minW="0"
        >
          <Plus size={12} />
        </IconButton>
      </HStack>

      {isLoading && (
        <Box px="12px" py="4px">
          <Spinner size="xs" color="#6C63FF" />
        </Box>
      )}

      {!isLoading && channels?.length === 0 && (
        <Text px="12px" color="rgba(244,244,246,0.3)" fontSize="13px">
          No channels yet
        </Text>
      )}

      <VStack gap="1px" alignItems="stretch" px="6px">
        {channels?.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isSelected={ch.id === selectedChannelId}
            onClick={() => onSelect(ch.id)}
          />
        ))}
      </VStack>
    </Box>
  );
}
