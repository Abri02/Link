import { useState } from "react";
import { VStack, HStack, Box, Center, Icon, Text } from "@chakra-ui/react";
import { Hash, Lock, Search, X, Users, AtSign } from "lucide-react";
import { IconAction } from "@/components/ui/IconAction";
import { BareInput, InputBox } from "@/components/ui/InputBox";
import { useMessages } from "@/feature/message/hooks/useMessages";
import { useMessageSearch } from "@/feature/message/hooks/useMessageSearch";
import { useChannelSocket } from "@/feature/message/hooks/useChannelSocket";
import { useTypingIndicator, typingLabel } from "@/feature/message/hooks/useTypingIndicator";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useConversations } from "@/feature/channel/hooks/useConversations";
import { ConversationMenu } from "@/feature/channel/components/ConversationMenu";
import { ChannelMenu } from "@/feature/channel/components/ChannelMenu";
import { CallButton } from "@/feature/call/components/CallButton";
import { conversationName } from "@/feature/channel/api/channel.types";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

export function MessageArea() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const { data: channels } = useChannels(selectedWorkspaceId);
  const { data: messages, isLoading } = useMessages(selectedChannelId);
  const { data: members } = useWorkspaceMembers(selectedWorkspaceId);
  const { data: conversations } = useConversations(selectedWorkspaceId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  useChannelSocket(selectedChannelId);
  const { typingUsers, notifyTyping } = useTypingIndicator(selectedChannelId, currentUserId);

  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length >= 2;
  const { data: searchResults, isFetching: searchLoading } = useMessageSearch(selectedChannelId, searchQuery);

  const channel = channels?.find((c) => c.id === selectedChannelId);
  const conversation = conversations?.find((c) => c.id === selectedChannelId);
  const title = conversation ? conversationName(conversation, currentUserId) : channel?.name ?? "";
  const HeaderIcon = !conversation ? (channel?.kind === "PRIVATE" ? Lock : Hash) : conversation.kind === "GROUP_DM" ? Users : AtSign;

  if (!selectedWorkspaceId) {
    return (
      <Center flex="1" bg="bg">
        <Text textStyle="body" color="fg.muted">
          Select a workspace to get started
        </Text>
      </Center>
    );
  }

  if (!selectedChannelId) {
    return (
      <Center flex="1" bg="bg">
        <Text textStyle="body" color="fg.muted">
          Select a channel
        </Text>
      </Center>
    );
  }

  return (
    <VStack flex="1" minW="0" bg="bg" gap="0" h="100vh">
      <HStack px="4" py="3" borderBottomWidth="1px" borderColor="border" w="full" gap="2" flexShrink={0}>
        <Icon as={HeaderIcon} boxSize="4" color="fg.muted" />
        <Text textStyle="title" color="fg" flex="1" truncate>
          {title}
        </Text>
        {conversation && <CallButton conversation={conversation} />}
        {conversation && <ConversationMenu conversation={conversation} />}
        {channel && <ChannelMenu channel={channel} />}
        <InputBox w="52" py="0" px="2">
          <Icon as={Search} boxSize="3.5" color="fg.muted" flexShrink={0} />
          <BareInput
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <IconAction label="Clear search" onClick={() => setSearchQuery("")}>
              <X size={12} />
            </IconAction>
          )}
        </InputBox>
      </HStack>

      {isSearching ? (
        <VStack flex="1" w="full" overflow="hidden">
          <Box px="4" py="1.5" w="full" borderBottomWidth="1px" borderColor="border" flexShrink={0}>
            <Text textStyle="caption" color="fg.muted">
              {searchLoading ? "Searching…" : `${searchResults?.length ?? 0} result${searchResults?.length === 1 ? "" : "s"} for "${searchQuery}"`}
            </Text>
          </Box>
          <MessageList messages={searchResults} isLoading={searchLoading} members={members ?? []} />
        </VStack>
      ) : (
        <MessageList messages={messages} isLoading={isLoading} members={members ?? []} />
      )}

      <Box w="full" borderTopWidth="1px" borderColor="border" flexShrink={0}>
        <MessageComposer
          channelId={selectedChannelId}
          channelName={channel?.name ?? ""}
          placeholder={conversation ? `Message ${title}` : undefined}
          onTyping={notifyTyping}
        />
        <Text
          data-testid="typing-indicator"
          px="4"
          pb="1.5"
          mt="-1.5"
          minH="6"
          textStyle="caption"
          fontStyle="italic"
          color="fg.muted"
          truncate
        >
          {typingLabel(typingUsers)}
        </Text>
      </Box>
    </VStack>
  );
}
