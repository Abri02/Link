import { VStack, Box, Text } from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { AppDialog } from "@/components/ui/AppDialog";
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

      <AppDialog open={open} onClose={onClose} title="New channel">
        <CreateChannelDialog workspaceId={selectedWorkspaceId} onClose={onClose} />
      </AppDialog>

      <AppDialog open={browseOpen} onClose={onBrowseClose} title="Browse channels">
        <BrowseChannelsDialog workspaceId={selectedWorkspaceId} onClose={onBrowseClose} />
      </AppDialog>

      <AppDialog open={newMessageOpen} onClose={onNewMessageClose} title="New message">
        <NewMessageDialog workspaceId={selectedWorkspaceId} onClose={onNewMessageClose} />
      </AppDialog>

      <AppDialog open={billingOpen} onClose={onBillingClose} title="Billing">
        <BillingDialog workspaceId={selectedWorkspaceId} />
      </AppDialog>

      <AppDialog open={inviteOpen} onClose={onInviteClose} title="Invite member">
        <InviteMemberDialog workspaceId={selectedWorkspaceId} onClose={onInviteClose} />
      </AppDialog>
    </VStack>
  );
}
