import { Flex, HStack } from "@chakra-ui/react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { ChannelSidebar } from "@/feature/channel/components/ChannelSidebar";
import { MessageArea } from "@/feature/message/components/MessageArea";
import { ThreadDrawer } from "@/feature/message/components/ThreadDrawer";
import { useNotificationSocket } from "@/feature/notification/hooks/useNotificationSocket";
import { useConversationSocket } from "@/feature/channel/hooks/useConversationSocket";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWebRtcCall } from "@/feature/call/hooks/useWebRtcCall";
import { IncomingCallDialog } from "@/feature/call/components/IncomingCallDialog";
import { CallWindow } from "@/feature/call/components/CallWindow";

export function WorkspacePage() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useNotificationSocket(userId);
  useConversationSocket(userId);
  useWebRtcCall(userId);
  // Below md there's only room for one pane: the sidebars, or the open conversation.
  const conversationOpen = useWorkspaceStore((s) => s.selectedChannelId != null);

  return (
    <>
      <HStack gap="0" h="100vh" overflow="hidden" bg="bg">
        <Flex
          display={{ base: conversationOpen ? "none" : "flex", md: "flex" }}
          flex={{ base: "1", md: "none" }}
          minW="0"
        >
          <WorkspaceSidebar />
          <ChannelSidebar />
        </Flex>
        <Flex
          display={{ base: conversationOpen ? "flex" : "none", md: "flex" }}
          flex="1"
          minW="0"
          alignSelf="stretch"
        >
          <MessageArea />
        </Flex>
      </HStack>
      <ThreadDrawer />
      <IncomingCallDialog />
      <CallWindow />
    </>
  );
}
