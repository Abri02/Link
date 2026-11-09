import { Box, Center, VStack, Spinner } from "@chakra-ui/react";
import { Hash, SearchX } from "lucide-react";
import { useRef, useEffect } from "react";
import type { Message } from "../api/message.types";
import type { MemberDetail } from "@/feature/workspace/api/workspace.types";
import { EmptyState } from "@/components/ui/EmptyState";
import { scrollMotion } from "@/util/motion";
import { MessageRow } from "./MessageRow";

interface Props {
  messages: Message[] | undefined;
  isLoading: boolean;
  members: MemberDetail[];
  isSearch?: boolean;
}

export function MessageList({ messages, isLoading, members, isSearch }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollMotion() });
  }, [messages]);

  return (
    <Box flex="1" overflow="auto" w="full" py="2">
      {isLoading && (
        <Center pt="8">
          <Spinner color="brand.solid" />
        </Center>
      )}

      {!isLoading && messages?.length === 0 && (
        <EmptyState icon={isSearch ? SearchX : Hash}>
          {isSearch ? "No messages match your search" : "No messages yet. Be the first to say something!"}
        </EmptyState>
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
