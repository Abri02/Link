import { HStack, IconButton, Menu, Portal, Dialog, Text, useDisclosure } from "@chakra-ui/react";
import { MoreVertical, Users, LogOut } from "lucide-react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useLeaveChannel } from "../hooks/useChannelMembership";
import { DEFAULT_CHANNEL, type Channel } from "../api/channel.types";
import { ChannelMembersDialog } from "./ChannelMembersDialog";

const ITEM_STYLES = {
  color: "#F4F4F6",
  fontSize: "13px",
  borderRadius: "4px",
  cursor: "pointer",
  _hover: { bg: "#38385E" },
} as const;

/** Header menu for public and private channels: members (private only) and leave. */
export function ChannelMenu({ channel }: { channel: Channel }) {
  const clearChannel = useWorkspaceStore((s) => s.clearChannel);
  const role = useMyWorkspaceRole(channel.workspaceId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const leave = useLeaveChannel(channel.workspaceId);
  const { open, onOpen, onClose } = useDisclosure();

  const isPrivate = channel.kind === "PRIVATE";
  const canLeave = !(channel.kind === "PUBLIC" && channel.name === DEFAULT_CHANNEL);
  if (!isPrivate && !canLeave) return null;

  const canManage = role === "OWNER" || role === "ADMIN" || channel.createdBy === currentUserId;

  return (
    <>
      {leave.error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {leave.error.message}
        </Text>
      )}
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            size="xs"
            variant="ghost"
            color="rgba(244,244,246,0.5)"
            _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
            aria-label="Channel options"
          >
            <MoreVertical size={14} />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content bg="#22223A" border="1px solid #38385E" borderRadius="8px" p="4px" minW="160px">
              {isPrivate && (
                <Menu.Item value="members" {...ITEM_STYLES} onClick={onOpen}>
                  <HStack gap="6px">
                    <Users size={12} />
                    <Text>Members</Text>
                  </HStack>
                </Menu.Item>
              )}
              {canLeave && (
                <Menu.Item
                  value="leave"
                  {...ITEM_STYLES}
                  color="#FF6B6B"
                  onClick={() => {
                    if (window.confirm(`Leave #${channel.name}?`)) leave.mutate(channel.id, { onSuccess: clearChannel });
                  }}
                >
                  <HStack gap="6px">
                    <LogOut size={12} />
                    <Text>Leave channel</Text>
                  </HStack>
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                Members of #{channel.name}
              </Dialog.Title>
              {open && <ChannelMembersDialog channel={channel} canManage={canManage} currentUserId={currentUserId} />}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
