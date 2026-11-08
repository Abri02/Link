import { Box, VStack, HStack, Text, Spinner } from "@chakra-ui/react";
import { Plus, Compass } from "lucide-react";
import { SidebarAction } from "@/components/ui/SidebarAction";
import type { Channel } from "../api/channel.types";
import { ChannelItem } from "./ChannelItem";

interface Props {
  channels: Channel[] | undefined;
  isLoading: boolean;
  selectedChannelId: number | null;
  onSelect: (id: number) => void;
  onAddClick: () => void;
  canCreate?: boolean;
  /** Guests can't browse or join channels. */
  onBrowseClick?: () => void;
}

export function ChannelList({ channels, isLoading, selectedChannelId, onSelect, onAddClick, canCreate, onBrowseClick }: Props) {
  return (
    <Box flex="1" overflow="auto" py="2">
      <HStack ps="4" pe="2" mb="1" gap="0.5">
        <Text color="sidebar.muted" textStyle="caption" flex="1">
          Channels
        </Text>
        {onBrowseClick && (
          <SidebarAction label="Browse channels" onClick={onBrowseClick}>
            <Compass size={13} />
          </SidebarAction>
        )}
        {canCreate && (
          <SidebarAction label="Add channel" onClick={onAddClick}>
            <Plus size={13} />
          </SidebarAction>
        )}
      </HStack>

      {isLoading && (
        <Box px="4" py="1">
          <Spinner size="xs" color="sidebar.muted" />
        </Box>
      )}

      {!isLoading && channels?.length === 0 && (
        <Text px="4" color="sidebar.muted" textStyle="label">
          No channels yet
        </Text>
      )}

      <VStack gap="0.5" alignItems="stretch" px="1.5">
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
