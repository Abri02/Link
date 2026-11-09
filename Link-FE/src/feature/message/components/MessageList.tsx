import { Box, Center, Icon, VStack, Text, Spinner } from "@chakra-ui/react";
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
    <Box flex="1" overflow="auto" w="full" py="2">
      {isLoading && (
        <Center pt="8">
          <Spinner color="brand.solid" />
        </Center>
      )}

      {!isLoading && messages?.length === 0 && (
        <Center flexDirection="column" h="full" gap="2">
          <Icon as={Hash} boxSize="8" color="fg.muted" />
          <Text textStyle="body" color="fg.muted">
            No messages yet. Be the first to say something!
          </Text>
        </Center>
      )}

      <VStack gap="0" alignItems="stretch">
        {messages?.map((msg, i) => (
          <MessageRow
            key={msg.id}
            message={msg}
            prevAuthorId={messages[i - 1]?.type === "SYSTEM" ? undefined : messages[i - 1]?.authorId}
            authorUsername={members.find((m) => m.userId === msg.authorId)?.username ?? `User ${msg.authorId}`}
          />
        ))}
      </VStack>
      <div ref={bottomRef} />
    </Box>
  );
}
