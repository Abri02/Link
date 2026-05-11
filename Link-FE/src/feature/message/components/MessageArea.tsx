import { VStack, HStack, Box, Text } from "@chakra-ui/react";
import { Hash } from "lucide-react";
import { useMessages } from "@/feature/message/hooks/useMessages";
import { useChannelSocket } from "@/feature/message/hooks/useChannelSocket";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

export function MessageArea() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const { data: channels } = useChannels(selectedWorkspaceId);
  const { data: messages, isLoading } = useMessages(selectedChannelId);
  useChannelSocket(selectedChannelId);

  const channel = channels?.find((c) => c.id === selectedChannelId);

  if (!selectedWorkspaceId) {
    return (
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" bg="#0A0A10">
        <Text color="rgba(244,244,246,0.3)" fontSize="15px">
          Select a workspace to get started
        </Text>
      </Box>
    );
  }

  if (!selectedChannelId) {
    return (
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" bg="#0A0A10">
        <Text color="rgba(244,244,246,0.3)" fontSize="15px">
          Select a channel
        </Text>
      </Box>
    );
  }

  return (
    <VStack flex="1" minW="0" bg="#0A0A10" gap="0" h="100vh">
      <HStack px="16px" py="12px" borderBottom="1px solid #16161F" w="full" gap="8px" flexShrink={0}>
        <Hash size={16} color="rgba(244,244,246,0.5)" />
        <Text color="#F4F4F6" fontWeight="600" fontSize="15px">
          {channel?.name ?? ""}
        </Text>
      </HStack>

      <MessageList messages={messages} isLoading={isLoading} />

      <Box w="full" borderTop="1px solid #16161F" flexShrink={0}>
        <MessageComposer channelId={selectedChannelId} channelName={channel?.name ?? ""} />
      </Box>
    </VStack>
  );
}
