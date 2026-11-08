import { Box, VStack, HStack, Text, IconButton, Spinner, Drawer } from "@chakra-ui/react";
import { X, MessageSquare } from "lucide-react";
import { useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
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
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content
          bg="#1A1A2E"
          borderLeft="1px solid #2A2A45"
          w="360px"
          maxW="360px"
          display="flex"
          flexDirection="column"
        >
          <HStack px="16px" py="12px" borderBottom="1px solid #2A2A45" flexShrink={0}>
            <MessageSquare size={15} color="rgba(244,244,246,0.5)" />
            <Text color="#F4F4F6" fontWeight="600" fontSize="15px" flex="1">
              Thread
            </Text>
            <IconButton
              size="xs"
              variant="ghost"
              color="rgba(244,244,246,0.4)"
              _hover={{ color: "#F4F4F6" }}
              aria-label="Close thread"
              onClick={closeThread}
              h="24px"
              w="24px"
              minW="0"
            >
              <X size={14} />
            </IconButton>
          </HStack>

          <Box flex="1" overflowY="auto" py="8px">
            {parentMessage && (
              <Box borderBottom="1px solid #2A2A45" pb="8px" mb="8px">
                <MessageRow
                  message={parentMessage}
                  authorUsername={members?.find((m) => m.userId === parentMessage.authorId)?.username ?? `User ${parentMessage.authorId}`}
                />
              </Box>
            )}

            {isLoading && (
              <Box display="flex" justifyContent="center" pt="16px">
                <Spinner size="sm" color="#6C63FF" />
              </Box>
            )}

            {isPlanLimitError(error) && (
              <Box px="16px" pt="16px">
                <UpsellNotice workspaceId={selectedWorkspaceId} message={error.message} />
              </Box>
            )}

            {!isLoading && replies?.length === 0 && (
              <Text color="rgba(244,244,246,0.3)" fontSize="13px" textAlign="center" pt="16px">
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
            <Box borderTop="1px solid #2A2A45" flexShrink={0}>
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
