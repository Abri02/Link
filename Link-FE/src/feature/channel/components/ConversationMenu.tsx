import { useDisclosure } from "@chakra-ui/react";
import { MoreVertical, UserPlus, Pencil, LogOut } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppMenu, AppMenuItem } from "@/components/ui/AppMenu";
import { FormError } from "@/components/ui/FormError";
import { IconAction } from "@/components/ui/IconAction";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useLeaveConversation, useRenameConversation } from "../hooks/useConversationActions";
import type { Conversation } from "../api/channel.types";
import { AddPeopleDialog } from "./AddPeopleDialog";

/**
 * Header menu for DMs and group DMs: add people, rename, leave.
 * Guests can only leave a group DM. The backend enforces the same rules.
 */
export function ConversationMenu({ conversation }: { conversation: Conversation }) {
  const clearChannel = useWorkspaceStore((s) => s.clearChannel);
  const role = useMyWorkspaceRole(conversation.workspaceId);
  const rename = useRenameConversation(conversation.workspaceId, conversation.id);
  const leave = useLeaveConversation(conversation.workspaceId, conversation.id);
  const { open, onOpen, onClose } = useDisclosure();

  const isGroup = conversation.kind === "GROUP_DM";
  const isGuest = role === "GUEST";
  if (isGuest && !isGroup) return null;

  const error = rename.error ?? leave.error;

  return (
    <>
      {error && <FormError>{error.message}</FormError>}
      <AppMenu
        trigger={
          <IconAction label="Conversation options" size="xs">
            <MoreVertical size={14} />
          </IconAction>
        }
      >
        {!isGuest && (
          <AppMenuItem icon={<UserPlus size={12} />} onClick={onOpen}>
            Add people
          </AppMenuItem>
        )}
        {isGroup && !isGuest && (
          <AppMenuItem
            icon={<Pencil size={12} />}
            onClick={() => {
              const title = window.prompt("Conversation name (leave empty to remove it)", conversation.title ?? "");
              if (title !== null) rename.mutate(title);
            }}
          >
            Rename
          </AppMenuItem>
        )}
        {isGroup && (
          <AppMenuItem
            icon={<LogOut size={12} />}
            danger
            onClick={() => {
              if (window.confirm("Leave this conversation?")) leave.mutate(undefined, { onSuccess: clearChannel });
            }}
          >
            Leave conversation
          </AppMenuItem>
        )}
      </AppMenu>

      <AppDialog open={open} onClose={onClose} title="Add people">
        <AddPeopleDialog conversation={conversation} onClose={onClose} />
      </AppDialog>
    </>
  );
}
