import { VStack, Box, Text, Dialog, Portal } from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useDms } from "@/feature/channel/hooks/useDms";
import { useOpenDm } from "@/feature/channel/hooks/useOpenDm";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaces } from "@/feature/workspace/hooks/useWorkspaces";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { ChannelList } from "./ChannelList";
import { DmItem } from "./DmItem";
import { MemberList } from "./MemberList";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { SidebarFooter } from "./SidebarFooter";

const SIDEBAR_STYLES = {
  w: "240px",
  minH: "100vh",
  bg: "#1A1A2E",
  borderRight: "1px solid #2A2A45",
} as const;

export function ChannelSidebar() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: workspaces } = useWorkspaces();
  const { data: channels, isLoading } = useChannels(selectedWorkspaceId);
  const { data: members } = useWorkspaceMembers(selectedWorkspaceId);
  const { data: dms } = useDms(selectedWorkspaceId);
  const { mutate: openDm } = useOpenDm(selectedWorkspaceId ?? 0);
  const { open, onOpen, onClose } = useDisclosure();
  const role = useMyWorkspaceRole(selectedWorkspaceId);
  const canCreate = role === "OWNER" || role === "ADMIN";

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
      <Box px="16px" py="14px" borderBottom="1px solid #2A2A45">
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
        canCreate={canCreate}
      />

      {dms && dms.length > 0 && (
        <Box borderTop="1px solid #2A2A45" flexShrink={0} py="8px">
          <Text
            color="rgba(244,244,246,0.3)"
            fontSize="11px"
            fontWeight="600"
            letterSpacing="0.08em"
            px="16px"
            mb="2px"
          >
            DIRECT MESSAGES
          </Text>
          <VStack gap="1px" alignItems="stretch" px="6px">
            {dms.map((dm) => (
              <DmItem
                key={dm.id}
                dm={dm}
                isSelected={dm.id === selectedChannelId}
                onClick={() => selectChannel(dm.id)}
              />
            ))}
          </VStack>
        </Box>
      )}

      {members && members.length > 0 && (
        <Box borderTop="1px solid #2A2A45" maxH="160px" overflow="auto" flexShrink={0}>
          <MemberList
            members={members}
            onStartDm={(userId) =>
              openDm(userId, { onSuccess: (dm) => selectChannel(dm.id) })
            }
          />
        </Box>
      )}

      <SidebarFooter />

      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
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
