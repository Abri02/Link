import { Box, VStack, HStack, Text } from "@chakra-ui/react";
import type { Message } from "../api/message.types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  message: Message;
  prevAuthorId?: number;
}

export function MessageRow({ message, prevAuthorId }: Props) {
  if (prevAuthorId === message.authorId) {
    return (
      <HStack gap="0" alignItems="flex-start" pl="48px" pr="16px" _hover={{ bg: "#0E0E18" }} py="1px">
        <Text color="#F4F4F6" fontSize="14px" lineHeight="1.5">
          {message.body}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack gap="10px" alignItems="flex-start" px="16px" pt="8px" _hover={{ bg: "#0E0E18" }} py="4px">
      <Box
        w="32px"
        h="32px"
        borderRadius="8px"
        bg="#22222E"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        mt="2px"
      >
        <Text fontSize="12px" fontWeight="700" color="#6C63FF">
          {String(message.authorId).slice(-2)}
        </Text>
      </Box>
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <HStack gap="8px">
          <Text color="#F4F4F6" fontSize="14px" fontWeight="600">
            User {message.authorId}
          </Text>
          <Text color="rgba(244,244,246,0.35)" fontSize="11px">
            {formatTime(message.createdAt)}
          </Text>
        </HStack>
        <Text color="#D4D4DC" fontSize="14px" lineHeight="1.5" wordBreak="break-word">
          {message.body}
        </Text>
      </VStack>
    </HStack>
  );
}
