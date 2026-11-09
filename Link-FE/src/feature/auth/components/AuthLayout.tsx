import type { ReactNode } from "react";
import { Box, Center, Heading, Text, VStack } from "@chakra-ui/react";
import { ThemePicker } from "@/components/ThemePicker";
import { LoginBrandPanel } from "./LoginBrandPanel";

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "44% 56%" }} minH="100dvh" bg="bg" position="relative">
      <LoginBrandPanel />
      <Center p={{ base: "6", md: "12" }}>
        <VStack gap="6" align="stretch" w="full" maxW="sm">
          <Text textStyle="title" display={{ base: "block", md: "none" }}>
            Link
          </Text>
          <Box>
            <Heading as="h1" textStyle="title">
              {title}
            </Heading>
            <Text textStyle="body" color="fg.muted">
              {subtitle}
            </Text>
          </Box>
          {children}
        </VStack>
      </Center>
      {/* Last in the DOM so the form comes first in tab order. */}
      <Box position="absolute" top="4" right="4" color="fg">
        <ThemePicker />
      </Box>
    </Box>
  );
}
