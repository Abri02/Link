import { useState } from "react";
import { VStack, HStack, Box, Text, Input, IconButton } from "@chakra-ui/react";
import { Hash, Search, X } from "lucide-react";
import { useMessages } from "@/feature/message/hooks/useMessages";
import { useMessageSearch } from "@/feature/message/hooks/useMessageSearch";
import { useChannelSocket } from "@/feature/message/hooks/useChannelSocket";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

export function MessageArea() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const { data: channels } = useChannels(selectedWorkspaceId);
  const { data: messages, isLoading } = useMessages(selectedChannelId);
  const { data: members } = useWorkspaceMembers(selectedWorkspaceId);
  useChannelSocket(selectedChannelId);

  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length >= 2;
  const { data: searchResults, isFetching: searchLoading } = useMessageSearch(selectedChannelId, searchQuery);

  const channel = channels?.find((c) => c.id === selectedChannelId);

  if (!selectedWorkspaceId) {
    return (
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" bg="#1C1C2E">
        <Text color="rgba(244,244,246,0.3)" fontSize="15px">
          Select a workspace to get started
        </Text>
      </Box>
    );
  }

  if (!selectedChannelId) {
    return (
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" bg="#1C1C2E">
        <Text color="rgba(244,244,246,0.3)" fontSize="15px">
          Select a channel
        </Text>
      </Box>
    );
  }

  return (
    <VStack flex="1" minW="0" bg="#1C1C2E" gap="0" h="100vh">
      <HStack px="16px" py="12px" borderBottom="1px solid #2A2A45" w="full" gap="8px" flexShrink={0}>
        <Hash size={16} color="rgba(244,244,246,0.5)" />
        <Text color="#F4F4F6" fontWeight="600" fontSize="15px" flex="1">
          {channel?.name ?? ""}
        </Text>
        <HStack gap="4px" w="200px">
          <Search size={14} color="rgba(244,244,246,0.35)" />
          <Input
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            variant="flushed"
            border="none"
            outline="none"
            boxShadow="none"
            color="#F4F4F6"
            fontSize="13px"
            _placeholder={{ color: "rgba(244,244,246,0.35)" }}
            _focusVisible={{ boxShadow: "none", borderColor: "transparent" }}
          />
          {searchQuery && (
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Clear search"
              color="rgba(244,244,246,0.4)"
              _hover={{ color: "#F4F4F6" }}
              h="20px"
              w="20px"
              minW="0"
              onClick={() => setSearchQuery("")}
            >
              <X size={12} />
            </IconButton>
          )}
        </HStack>
      </HStack>

      {isSearching ? (
        <VStack flex="1" w="full" overflow="hidden">
          <Box px="16px" py="6px" w="full" borderBottom="1px solid #2A2A45" flexShrink={0}>
            <Text color="rgba(244,244,246,0.4)" fontSize="12px">
              {searchLoading ? "Searching…" : `${searchResults?.length ?? 0} result${searchResults?.length === 1 ? "" : "s"} for "${searchQuery}"`}
            </Text>
          </Box>
          <MessageList messages={searchResults} isLoading={searchLoading} members={members ?? []} />
        </VStack>
      ) : (
        <MessageList messages={messages} isLoading={isLoading} members={members ?? []} />
      )}

      <Box w="full" borderTop="1px solid #2A2A45" flexShrink={0}>
        <MessageComposer channelId={selectedChannelId} channelName={channel?.name ?? ""} />
      </Box>
    </VStack>
  );
}
