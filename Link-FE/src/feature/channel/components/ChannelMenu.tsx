import { useDisclosure } from "@chakra-ui/react";
import { MoreVertical, Users, LogOut } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppMenu, AppMenuItem } from "@/components/ui/AppMenu";
import { FormError } from "@/components/ui/FormError";
import { IconAction } from "@/components/ui/IconAction";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useLeaveChannel } from "../hooks/useChannelMembership";
import { DEFAULT_CHANNEL, type Channel } from "../api/channel.types";
import { ChannelMembersDialog } from "./ChannelMembersDialog";

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
      {leave.error && <FormError>{leave.error.message}</FormError>}
      <AppMenu
        trigger={
          <IconAction label="Channel options" size="xs">
            <MoreVertical size={14} />
          </IconAction>
        }
      >
        {isPrivate && (
          <AppMenuItem icon={<Users size={12} />} onClick={onOpen}>
            Members
          </AppMenuItem>
        )}
        {canLeave && (
          <AppMenuItem
            icon={<LogOut size={12} />}
            danger
            onClick={() => {
              if (window.confirm(`Leave #${channel.name}?`)) leave.mutate(channel.id, { onSuccess: clearChannel });
            }}
          >
            Leave channel
          </AppMenuItem>
        )}
      </AppMenu>

      <AppDialog open={open} onClose={onClose} title={`Members of #${channel.name}`}>
        <ChannelMembersDialog channel={channel} canManage={canManage} currentUserId={currentUserId} />
      </AppDialog>
    </>
  );
}
