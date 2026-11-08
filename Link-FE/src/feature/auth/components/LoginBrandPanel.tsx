import { Box, Circle, Flex, Text, VStack } from "@chakra-ui/react";

const PREVIEW_MESSAGES = [
  { initial: "M", name: "Mira Vale", body: "The release notes are ready for review." },
  { initial: "T", name: "Tobin Reed", body: "Thanks, I'll read them after standup." },
  { initial: "S", name: "Sana Holt", body: "Can we do a quick call at two?" },
];

function ChatPreview() {
  return (
    <Box aria-hidden borderWidth="1px" borderColor="sidebar.active" borderRadius="l2" bg="sidebar.hover" p="4">
      <Text textStyle="label" mb="3">
        # general
      </Text>
      <VStack gap="3" align="stretch">
        {PREVIEW_MESSAGES.map((message) => (
          <Flex key={message.name} gap="2">
            <Circle size="8" flexShrink="0" bg="sidebar.active" textStyle="label">
              {message.initial}
            </Circle>
            <Box>
              <Text textStyle="label">{message.name}</Text>
              <Text textStyle="caption" color="sidebar.muted">
                {message.body}
              </Text>
            </Box>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
}

export function LoginBrandPanel() {
  return (
    <Flex
      display={{ base: "none", md: "flex" }}
      direction="column"
      justify="space-between"
      gap="8"
      p={{ md: "8", lg: "12" }}
      bg="sidebar.bg"
      color="sidebar.fg"
    >
      <Text textStyle="title">Link</Text>
      <Text textStyle="display">Channels, messages and calls for your team.</Text>
      <ChatPreview />
    </Flex>
  );
}
