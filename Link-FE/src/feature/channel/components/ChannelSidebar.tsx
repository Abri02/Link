import { VStack, Box, HStack, Text, IconButton, Dialog, Portal } from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { UserPlus, LogOut, Plus } from "lucide-react";
import { Tip } from "@/components/Tip";
import { InviteMemberDialog } from "@/feature/workspace/components/InviteMemberDialog";
import { useChannels } from "@/feature/channel/hooks/useChannels";
import { useConversations } from "@/feature/channel/hooks/useConversations";
import { useOpenConversation } from "@/feature/channel/hooks/useOpenConversation";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaces } from "@/feature/workspace/hooks/useWorkspaces";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useChangeRole } from "@/feature/workspace/hooks/useChangeRole";
import { useRemoveMember } from "@/feature/workspace/hooks/useRemoveMember";
import { useLeaveWorkspace } from "@/feature/workspace/hooks/useLeaveWorkspace";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { ChannelList } from "./ChannelList";
import { ConversationItem } from "./ConversationItem";
import { NewMessageDialog } from "./NewMessageDialog";
import { MemberList } from "./MemberList";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { BrowseChannelsDialog } from "./BrowseChannelsDialog";
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
  const { data: conversations } = useConversations(selectedWorkspaceId);
  const { mutate: openConversation } = useOpenConversation(selectedWorkspaceId ?? 0);
  const { open, onOpen, onClose } = useDisclosure();
  const { open: inviteOpen, onOpen: onInviteOpen, onClose: onInviteClose } = useDisclosure();
  const { open: browseOpen, onOpen: onBrowseOpen, onClose: onBrowseClose } = useDisclosure();
  const { open: newMessageOpen, onOpen: onNewMessageOpen, onClose: onNewMessageClose } = useDisclosure();
  const role = useMyWorkspaceRole(selectedWorkspaceId);
  const canCreate = role === "OWNER" || role === "ADMIN";
  const changeRole = useChangeRole(selectedWorkspaceId ?? 0);
  const removeMember = useRemoveMember(selectedWorkspaceId ?? 0);
  const leaveWorkspace = useLeaveWorkspace(selectedWorkspaceId ?? 0);
  const currentUserId = useAuthStore((s) => s.user?.id);

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
      <HStack px="16px" py="14px" borderBottom="1px solid #2A2A45" justify="space-between">
        <Text color="#F4F4F6" fontWeight="600" fontSize="15px" truncate>
          {workspace?.name ?? ""}
        </Text>
        <HStack gap="2px" flexShrink={0}>
          {canCreate && (
            <Tip label="Invite member" placement="right">
              <IconButton
                onClick={onInviteOpen}
                size="xs"
                bg="transparent"
                color="rgba(244,244,246,0.4)"
                _hover={{ color: "#6C63FF", bg: "transparent" }}
                aria-label="Invite member"
              >
                <UserPlus size={14} />
              </IconButton>
            </Tip>
          )}
          <Tip label="Leave workspace" placement="right">
            <IconButton
              onClick={() => {
                if (window.confirm(`Leave ${workspace?.name ?? "this workspace"}?`)) leaveWorkspace.mutate();
              }}
              size="xs"
              bg="transparent"
              color="rgba(244,244,246,0.4)"
              _hover={{ color: "#FF6B6B", bg: "transparent" }}
              aria-label="Leave workspace"
            >
              <LogOut size={14} />
            </IconButton>
          </Tip>
        </HStack>
      </HStack>
      {leaveWorkspace.error && (
        <Text color="#FF6B6B" fontSize="12px" px="16px" pt="6px" role="alert">
          {leaveWorkspace.error.message}
        </Text>
      )}

      <ChannelList
        channels={channels}
        isLoading={isLoading}
        selectedChannelId={selectedChannelId}
        onSelect={selectChannel}
        onAddClick={onOpen}
        canCreate={canCreate}
        onBrowseClick={role && role !== "GUEST" ? onBrowseOpen : undefined}
      />

      {(role !== "GUEST" || (conversations && conversations.length > 0)) && (
        <Box borderTop="1px solid #2A2A45" flexShrink={0} py="8px" position="relative">
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
          {/* Guests can't start conversations (the backend returns 403), but they see the ones they were added to. */}
          {role !== "GUEST" && (
            <Tip label="New message" placement="right">
              <IconButton
                onClick={onNewMessageOpen}
                position="absolute"
                top="5px"
                right="10px"
                size="2xs"
                minW="18px"
                h="18px"
                bg="transparent"
                color="rgba(244,244,246,0.4)"
                _hover={{ color: "#6C63FF", bg: "transparent" }}
                aria-label="New message"
              >
                <Plus size={13} />
              </IconButton>
            </Tip>
          )}
          <VStack gap="1px" alignItems="stretch" px="6px">
            {conversations?.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isSelected={c.id === selectedChannelId}
                onClick={() => selectChannel(c.id)}
              />
            ))}
          </VStack>
        </Box>
      )}

      {members && members.length > 0 && (
        <Box borderTop="1px solid #2A2A45" maxH="160px" overflow="auto" flexShrink={0}>
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
