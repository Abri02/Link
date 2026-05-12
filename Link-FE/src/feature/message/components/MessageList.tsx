import { Box, VStack, Text, Spinner } from "@chakra-ui/react";
import { Hash } from "lucide-react";
import { useRef, useEffect } from "react";
import type { Message } from "../api/message.types";
import type { MemberDetail } from "@/feature/workspace/api/workspace.types";
import { MessageRow } from "./MessageRow";

interface Props {
  messages: Message[] | undefined;
  isLoading: boolean;
  members: MemberDetail[];
}

export function MessageList({ messages, isLoading, members }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box flex="1" overflow="auto" w="full" py="8px">
      {isLoading && (
        <Box display="flex" justifyContent="center" pt="32px">
          <Spinner color="#6C63FF" />
        </Box>
      )}

      {!isLoading && messages?.length === 0 && (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" h="full" gap="8px">
          <Hash size={32} color="rgba(244,244,246,0.15)" />
          <Text color="rgba(244,244,246,0.3)" fontSize="14px">
            No messages yet. Be the first to say something!
          </Text>
        </Box>
      )}

      <VStack gap="0" alignItems="stretch">
        {messages?.map((msg, i) => (
          <MessageRow
            key={msg.id}
            message={msg}
            prevAuthorId={messages[i - 1]?.authorId}
            authorUsername={members.find((m) => m.userId === msg.authorId)?.username ?? `User ${msg.authorId}`}
          />
        ))}
      </VStack>
      <div ref={bottomRef} />
    </Box>
  );
}
