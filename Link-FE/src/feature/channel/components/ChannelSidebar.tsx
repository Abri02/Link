import { VStack, Box, Text, Dialog, Portal } from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaces } from "@/feature/workspace/hooks/useWorkspaces";
import { ChannelList } from "./ChannelList";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { SidebarFooter } from "./SidebarFooter";

const SIDEBAR_STYLES = {
  w: "240px",
  minH: "100vh",
  bg: "#0D0D15",
  borderRight: "1px solid #16161F",
} as const;

export function ChannelSidebar() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: workspaces } = useWorkspaces();
  const { data: channels, isLoading } = useChannels(selectedWorkspaceId);
  const { open, onOpen, onClose } = useDisclosure();

  const workspace = workspaces?.find((w) => w.id === selectedWorkspaceId);

  if (!selectedWorkspaceId) {
    return (
      <VStack {...SIDEBAR_STYLES} alignItems="stretch" gap="0">
        <Box flex="1" display="flex" alignItems="center" justifyContent="center">
          <Text color="rgba(244,244,246,0.3)" fontSize="13px" textAlign="center" px="16px">
            Select a workspace
          </Text>
        </Box>
        <SidebarFooter />
      </VStack>
    );
  }

  return (
    <VStack {...SIDEBAR_STYLES} alignItems="stretch" gap="0">
      <Box px="16px" py="14px" borderBottom="1px solid #16161F">
        <Text color="#F4F4F6" fontWeight="600" fontSize="15px" truncate>
          {workspace?.name ?? ""}
        </Text>
      </Box>

      <ChannelList
        channels={channels}
        isLoading={isLoading}
        selectedChannelId={selectedChannelId}
        onSelect={selectChannel}
        onAddClick={onOpen}
      />

      <SidebarFooter />

      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#12121A" border="1px solid #22222E" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                New channel
              </Dialog.Title>
              <CreateChannelDialog workspaceId={selectedWorkspaceId} onClose={onClose} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
