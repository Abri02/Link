import { HStack, IconButton, Menu, Portal, Dialog, Text, useDisclosure } from "@chakra-ui/react";
import { MoreVertical, UserPlus, Pencil, LogOut } from "lucide-react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useLeaveConversation, useRenameConversation } from "../hooks/useConversationActions";
import type { Conversation } from "../api/channel.types";
import { AddPeopleDialog } from "./AddPeopleDialog";

const ITEM_STYLES = {
  color: "#F4F4F6",
  fontSize: "13px",
  borderRadius: "4px",
  cursor: "pointer",
  _hover: { bg: "#38385E" },
} as const;

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
      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            size="xs"
            variant="ghost"
            color="rgba(244,244,246,0.5)"
            _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
            aria-label="Conversation options"
          >
            <MoreVertical size={14} />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content bg="#22223A" border="1px solid #38385E" borderRadius="8px" p="4px" minW="160px">
              {!isGuest && (
                <Menu.Item value="add" {...ITEM_STYLES} onClick={onOpen}>
                  <HStack gap="6px">
                    <UserPlus size={12} />
                    <Text>Add people</Text>
                  </HStack>
                </Menu.Item>
              )}
              {isGroup && !isGuest && (
                <Menu.Item
                  value="rename"
                  {...ITEM_STYLES}
                  onClick={() => {
                    const title = window.prompt("Conversation name (leave empty to remove it)", conversation.title ?? "");
                    if (title !== null) rename.mutate(title);
                  }}
                >
                  <HStack gap="6px">
                    <Pencil size={12} />
                    <Text>Rename</Text>
                  </HStack>
                </Menu.Item>
              )}
              {isGroup && (
                <Menu.Item
                  value="leave"
                  {...ITEM_STYLES}
                  color="#FF6B6B"
                  onClick={() => {
                    if (window.confirm("Leave this conversation?")) leave.mutate(undefined, { onSuccess: clearChannel });
                  }}
                >
                  <HStack gap="6px">
                    <LogOut size={12} />
                    <Text>Leave conversation</Text>
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
                Add people
              </Dialog.Title>
              {open && <AddPeopleDialog conversation={conversation} onClose={onClose} />}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
