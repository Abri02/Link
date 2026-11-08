import { VStack, Box, Text, Dialog, Portal } from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { BillingDialog } from "@/feature/billing/components/BillingDialog";
import { InviteMemberDialog } from "@/feature/workspace/components/InviteMemberDialog";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useOpenConversation } from "@/feature/channel/hooks/useOpenConversation";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useChangeRole } from "@/feature/workspace/hooks/useChangeRole";
import { useRemoveMember } from "@/feature/workspace/hooks/useRemoveMember";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { ChannelList } from "./ChannelList";
import { ChannelSidebarHeader } from "./ChannelSidebarHeader";
import { ConversationSection } from "./ConversationSection";
import { NewMessageDialog } from "./NewMessageDialog";
import { MemberList } from "./MemberList";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { BrowseChannelsDialog } from "./BrowseChannelsDialog";
import { SidebarFooter } from "./SidebarFooter";

const SIDEBAR_STYLES = {
  w: "60",
  minH: "100vh",
  bg: "sidebar.bg",
  borderRightWidth: "1px",
  borderColor: "sidebar.border",
} as const;

export function ChannelSidebar() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: channels, isLoading } = useChannels(selectedWorkspaceId);
  const { data: members } = useWorkspaceMembers(selectedWorkspaceId);
  const { mutate: openConversation } = useOpenConversation(selectedWorkspaceId ?? 0);
  const { open, onOpen, onClose } = useDisclosure();
  const { open: inviteOpen, onOpen: onInviteOpen, onClose: onInviteClose } = useDisclosure();
  const { open: browseOpen, onOpen: onBrowseOpen, onClose: onBrowseClose } = useDisclosure();
  const { open: newMessageOpen, onOpen: onNewMessageOpen, onClose: onNewMessageClose } = useDisclosure();
  const { open: billingOpen, onOpen: onBillingOpen, onClose: onBillingClose } = useDisclosure();
  const role = useMyWorkspaceRole(selectedWorkspaceId);
  const canCreate = role === "OWNER" || role === "ADMIN";
  const changeRole = useChangeRole(selectedWorkspaceId ?? 0);
  const removeMember = useRemoveMember(selectedWorkspaceId ?? 0);
  const currentUserId = useAuthStore((s) => s.user?.id);

  if (!selectedWorkspaceId) {
    return (
      <VStack {...SIDEBAR_STYLES} alignItems="stretch" gap="0">
        <Box flex="1" display="flex" alignItems="center" justifyContent="center">
          <Text color="sidebar.muted" textStyle="label" textAlign="center" px="4">
            Select a workspace
          </Text>
        </Box>
        <SidebarFooter />
      </VStack>
    );
  }

  return (
    <VStack {...SIDEBAR_STYLES} alignItems="stretch" gap="0">
      <ChannelSidebarHeader
        workspaceId={selectedWorkspaceId}
        onBillingClick={onBillingOpen}
        onInviteClick={onInviteOpen}
      />

      <ChannelList
        channels={channels}
        isLoading={isLoading}
        selectedChannelId={selectedChannelId}
        onSelect={selectChannel}
        onAddClick={onOpen}
        canCreate={canCreate}
        onBrowseClick={role && role !== "GUEST" ? onBrowseOpen : undefined}
      />

      <ConversationSection workspaceId={selectedWorkspaceId} onNewMessageClick={onNewMessageOpen} />

      {members && members.length > 0 && (
        <Box borderTopWidth="1px" borderColor="sidebar.border" maxH="40" overflow="auto" flexShrink={0}>
          <MemberList
            members={members}
            onStartDm={
              // Guests can't open DMs (the backend returns 403), so their member names aren't clickable.
              role === "GUEST"
                ? undefined
                : (userId) => openConversation({ userIds: [userId] }, { onSuccess: (c) => selectChannel(c.id) })
            }
            onChangeRole={
              role === "OWNER" ? (userId, newRole) => changeRole.mutate({ userId, role: newRole }) : undefined
            }
            roleError={(changeRole.error ?? removeMember.error)?.message ?? null}
            onRemove={
              canCreate
                ? (m) => {
                    if (window.confirm(`Remove ${m.username} from the workspace?`)) removeMember.mutate(m.userId);
                  }
                : undefined
            }
            canRemove={(m) => m.userId !== currentUserId && (role === "OWNER" || m.role !== "OWNER")}
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

      <Dialog.Root open={browseOpen} onOpenChange={(e) => !e.open && onBrowseClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                Browse channels
              </Dialog.Title>
              {browseOpen && <BrowseChannelsDialog workspaceId={selectedWorkspaceId} onClose={onBrowseClose} />}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={newMessageOpen} onOpenChange={(e) => !e.open && onNewMessageClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                New message
              </Dialog.Title>
              {newMessageOpen && <NewMessageDialog workspaceId={selectedWorkspaceId} onClose={onNewMessageClose} />}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={billingOpen} onOpenChange={(e) => !e.open && onBillingClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                Billing
              </Dialog.Title>
              {billingOpen && <BillingDialog workspaceId={selectedWorkspaceId} />}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={inviteOpen} onOpenChange={(e) => !e.open && onInviteClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                Invite member
              </Dialog.Title>
              <InviteMemberDialog workspaceId={selectedWorkspaceId} onClose={onInviteClose} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
