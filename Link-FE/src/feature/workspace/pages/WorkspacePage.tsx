import { HStack } from "@chakra-ui/react";
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

  return (
    <>
      <HStack gap="0" h="100vh" overflow="hidden" bg="#1C1C2E">
        <WorkspaceSidebar />
        <ChannelSidebar />
        <MessageArea />
      </HStack>
      <ThreadDrawer />
      <IncomingCallDialog />
      <CallWindow />
    </>
  );
}
