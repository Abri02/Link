import { HStack } from "@chakra-ui/react";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { AppMenu, AppMenuItem } from "@/components/ui/AppMenu";
import { IconAction } from "@/components/ui/IconAction";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useDeleteMessage } from "../hooks/useDeleteMessage";
import type { Message } from "../api/message.types";

export function MessageActions({ message, onEdit }: { message: Message; onEdit: () => void }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const openThread = useWorkspaceStore((s) => s.openThread);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const role = useMyWorkspaceRole(selectedWorkspaceId);
  const { mutate: deleteMsg } = useDeleteMessage(message.channelId);

  const isAuthor = message.authorId === currentUserId;
  // Owners and admins can moderate (delete) anyone's message. The backend enforces this too.
  const canDelete = isAuthor || role === "OWNER" || role === "ADMIN";
  const isReply = message.parentMessageId != null;

  return (
    <HStack gap="0.5">
      {!isReply && (
        <IconAction label="Reply in thread" onClick={() => openThread(message.id)}>
          <MessageSquare size={14} />
        </IconAction>
      )}
      {canDelete && (
        <AppMenu
          trigger={
            <IconAction label="Message actions">
              <MoreHorizontal size={14} />
            </IconAction>
          }
        >
          {isAuthor && (
            <AppMenuItem icon={<Pencil size={14} />} onClick={onEdit}>
              Edit
            </AppMenuItem>
          )}
          <AppMenuItem icon={<Trash2 size={14} />} danger onClick={() => deleteMsg(message.id)}>
            Delete
          </AppMenuItem>
        </AppMenu>
      )}
    </HStack>
  );
}
