import { Hash, Send } from "lucide-react";
import {
  Box,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";

export default function App() {
  return (
    <Flex h="100vh" w="100%" bg="white" color="slate.900">
      {/* 1. Workspace Sidebar (Narrow) */}
      <VStack
        as="nav"
        w="64px"
        bg="slate.900"
        py={4}
        gap={4}
        color="white"
        align="center"
      >
        <Flex
          w="40px"
          h="40px"
          bg="indigo.600"
          rounded="lg"
          align="center"
          justify="center"
          fontWeight="bold"
        >
          L
        </Flex>
        <Flex
          w="40px"
          h="40px"
          bg="slate.700"
          rounded="lg"
          align="center"
          justify="center"
          cursor="pointer"
          _hover={{ bg: "slate.600" }}
        >
          +
        </Flex>
      </VStack>

      {/* 2. Channel Sidebar */}
      <Flex
        as="aside"
        w="256px"
        bg="slate.800"
        color="slate.300"
        direction="column"
      >
        <Flex
          as="header"
          p={4}
          borderBottomWidth="1px"
          borderColor="slate.700"
          justify="space-between"
          align="center"
          color="white"
        >
          <Heading size="md" fontWeight="bold">
            Link Workspace
          </Heading>
        </Flex>
        <Box flex="1" overflowY="auto" p={2}>
          <Box mb={4}>
            <Heading
              as="h3"
              px={2}
              fontSize="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
              mb={2}
            >
              Channels
            </Heading>
            <HStack
              as="button"
              w="100%"
              px={2}
              py={1}
              rounded="md"
              bg="slate.700"
              color="white"
              gap={2}
              _hover={{ bg: "slate.700" }}
            >
              <Hash size={18} />
              <Text>general</Text>
            </HStack>
            <HStack
              as="button"
              w="100%"
              px={2}
              py={1}
              rounded="md"
              gap={2}
              _hover={{ bg: "slate.700" }}
            >
              <Hash size={18} />
              <Text>development</Text>
            </HStack>
          </Box>
        </Box>
      </Flex>

      {/* 3. Main Chat Area */}
      <Flex as="main" flex="1" direction="column">
        <Flex
          as="header"
          h="56px"
          borderBottomWidth="1px"
          align="center"
          px={6}
          justify="space-between"
        >
          <HStack gap={2}>
            <Box color="slate.500">
              <Hash size={20} />
            </Box>
            <Text fontWeight="bold">general</Text>
          </HStack>
        </Flex>

        <Box flex="1" p={6} overflowY="auto">
          <HStack gap={4} mb={6} align="flex-start">
            <Box w="40px" h="40px" bg="slate.200" rounded="md" flexShrink={0} />
            <Box>
              <HStack gap={2} mb={1}>
                <Text fontWeight="bold">John Doe</Text>
                <Text fontSize="xs" color="slate.500">
                  10:30 PM
                </Text>
              </HStack>
              <Text color="slate.700">
                Welcome to Link! This is our first message.
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* Input Area */}
        <Box as="footer" p={4}>
          <Flex
            borderWidth="2px"
            borderColor="slate.200"
            rounded="lg"
            p={2}
            align="center"
          >
            <Input
              placeholder="Message #general"
              variant="outline"
              border="none"
              _focus={{ boxShadow: "none" }}
              flex="1"
              px={2}
            />
            <IconButton
              aria-label="Send message"
              variant="ghost"
              size="sm"
              color="slate.500"
            >
              <Send size={20} />
            </IconButton>
          </Flex>
        </Box>
      </Flex>
    </Flex>
  );
}
