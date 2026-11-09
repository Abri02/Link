import { Box, Center, Icon, VStack, HStack, Text, Spinner, Drawer } from "@chakra-ui/react";
import { X, MessageSquare } from "lucide-react";
import { useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { IconAction } from "@/components/ui/IconAction";
import { UpsellNotice } from "@/feature/billing/components/UpsellNotice";
import { isPlanLimitError } from "@/util/apiClient";
import { useThreadMessages } from "../hooks/useThreadMessages";
import { useThreadSocket } from "../hooks/useThreadSocket";
import { MessageRow } from "./MessageRow";
import { MessageComposer } from "./MessageComposer";
import { useMessages } from "../hooks/useMessages";

export function ThreadDrawer() {
  const threadMessageId = useWorkspaceStore((s) => s.threadMessageId);
  const closeThread = useWorkspaceStore((s) => s.closeThread);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);

  const { data: members } = useWorkspaceMembers(selectedWorkspaceId);
  const { data: channelMessages } = useMessages(selectedChannelId);
  const { data: replies, isLoading, error } = useThreadMessages(selectedChannelId, threadMessageId);
  useThreadSocket(threadMessageId);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const parentMessage = channelMessages?.find((m) => m.id === threadMessageId);

  return (
    <Drawer.Root open={threadMessageId != null} onOpenChange={(e) => { if (!e.open) closeThread(); }} placement="end">
      <Drawer.Backdrop bg="overlay" />
      <Drawer.Positioner>
        <Drawer.Content
          borderLeftWidth="1px"
          borderColor="border"
          w="360px"
          maxW="360px"
          display="flex"
          flexDirection="column"
        >
          <HStack px="4" py="3" borderBottomWidth="1px" borderColor="border" flexShrink={0}>
            <Icon as={MessageSquare} boxSize="4" color="fg.muted" />
            <Text textStyle="title" color="fg" flex="1">
              Thread
            </Text>
            <IconAction label="Close thread" onClick={closeThread}>
              <X size={14} />
            </IconAction>
          </HStack>

          <Box flex="1" overflowY="auto" py="2">
            {parentMessage && (
              <Box borderBottomWidth="1px" borderColor="border" pb="2" mb="2">
                <MessageRow
                  message={parentMessage}
                  authorUsername={members?.find((m) => m.userId === parentMessage.authorId)?.username ?? `User ${parentMessage.authorId}`}
                />
              </Box>
            )}

            {isLoading && (
              <Center pt="4">
                <Spinner size="sm" color="brand.solid" />
              </Center>
            )}

            {isPlanLimitError(error) && (
              <Box px="4" pt="4">
                <UpsellNotice workspaceId={selectedWorkspaceId} message={error.message} />
              </Box>
            )}

            {!isLoading && replies?.length === 0 && (
              <Text textStyle="label" color="fg.muted" textAlign="center" pt="4">
                No replies yet.
              </Text>
            )}

            <VStack gap="0" alignItems="stretch">
              {replies?.map((reply, i) => (
                <MessageRow
                  key={reply.id}
                  message={reply}
                  prevAuthorId={replies[i - 1]?.authorId}
                  authorUsername={members?.find((m) => m.userId === reply.authorId)?.username ?? `User ${reply.authorId}`}
                />
              ))}
            </VStack>
            <div ref={bottomRef} />
          </Box>

          {selectedChannelId != null && threadMessageId != null && (
            <Box borderTopWidth="1px" borderColor="border" flexShrink={0}>
              <MessageComposer
                channelId={selectedChannelId}
                channelName="thread"
                parentMessageId={threadMessageId}
              />
            </Box>
          )}
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
