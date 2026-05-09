import { HStack } from "@chakra-ui/react";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { ChannelSidebar } from "@/feature/channel/components/ChannelSidebar";
import { MessageArea } from "@/feature/message/components/MessageArea";

export function WorkspacePage() {
  return (
    <HStack gap="0" h="100vh" overflow="hidden" bg="#0A0A10">
      <WorkspaceSidebar />
      <ChannelSidebar />
      <MessageArea />
    </HStack>
  );
}
