import { useState, useRef, useEffect } from "react";
import { Box, VStack, HStack, Text, Button, Popover, Portal, IconButton, Menu, Input } from "@chakra-ui/react";
import { Smile, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useToggleReaction } from "../hooks/useToggleReaction";
import { useEditMessage } from "../hooks/useEditMessage";
import { useDeleteMessage } from "../hooks/useDeleteMessage";
import type { Message } from "../api/message.types";

const EMOJI_PICKER = ["👍", "❤️", "😂", "🎉", "🔥", "😮", "😢", "👀"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  message: Message;
  prevAuthorId?: number;
  authorUsername: string;
}

function ReactionArea({ message }: { message: Message }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { mutate: toggleReaction } = useToggleReaction(message.channelId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasReactions = Object.keys(message.reactions).length > 0;

  function toggle(emoji: string) {
    if (currentUserId == null) return;
    const userIds = message.reactions[emoji] ?? [];
    const hasReacted = userIds.includes(currentUserId);
    toggleReaction({ messageId: message.id, emoji, hasReacted, currentUserId });
  }

  return (
    <HStack gap="4px" flexWrap="wrap" mt={hasReactions ? "4px" : "0"}>
      {Object.entries(message.reactions).map(([emoji, userIds]) => {
        const hasReacted = currentUserId != null && userIds.includes(currentUserId);
        return (
          <Button
            key={emoji}
            size="xs"
            variant="outline"
            borderColor={hasReacted ? "#6C63FF" : "#2A2A38"}
            bg={hasReacted ? "#1E1E3A" : "#16161F"}
            color="#F4F4F6"
            fontSize="12px"
            h="22px"
            px="6px"
            _hover={{ borderColor: "#6C63FF", bg: "#1E1E2E" }}
            onClick={() => toggle(emoji)}
          >
            {emoji} {userIds.length}
          </Button>
        );
      })}

      <Popover.Root open={pickerOpen} onOpenChange={(e) => setPickerOpen(e.open)}>
        <Popover.Trigger asChild>
          <Button
            size="xs"
            variant="ghost"
            color="rgba(244,244,246,0.3)"
            _hover={{ color: "#F4F4F6", bg: "#1E1E2E" }}
            h="22px"
            w="22px"
            minW="0"
            p="0"
          >
            <Smile size={13} />
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content bg="#1A1A26" border="1px solid #2A2A38" borderRadius="8px" p="6px" w="auto">
              <HStack gap="4px">
                {EMOJI_PICKER.map((emoji) => (
                  <Button
                    key={emoji}
                    size="xs"
                    variant="ghost"
                    fontSize="16px"
                    h="28px"
                    w="28px"
                    minW="0"
                    p="0"
                    _hover={{ bg: "#2A2A38" }}
                    onClick={() => { toggle(emoji); setPickerOpen(false); }}
                  >
                    {emoji}
                  </Button>
                ))}
              </HStack>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </HStack>
  );
}

function MessageActions({ message, onEdit }: { message: Message; onEdit: () => void }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { mutate: deleteMsg } = useDeleteMessage(message.channelId);

  if (message.authorId !== currentUserId) return null;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          size="xs"
          variant="ghost"
          color="rgba(244,244,246,0.3)"
          _hover={{ color: "#F4F4F6", bg: "#1E1E2E" }}
          aria-label="Message actions"
          h="22px"
          w="22px"
          minW="0"
        >
          <MoreHorizontal size={13} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content bg="#1A1A26" border="1px solid #2A2A38" borderRadius="8px" p="4px" minW="120px">
            <Menu.Item
              value="edit"
              color="#F4F4F6"
              fontSize="13px"
              borderRadius="4px"
              _hover={{ bg: "#2A2A38" }}
              cursor="pointer"
              onClick={onEdit}
            >
              <HStack gap="6px">
                <Pencil size={12} />
                <Text>Edit</Text>
              </HStack>
            </Menu.Item>
            <Menu.Item
              value="delete"
              color="#FF6B6B"
              fontSize="13px"
              borderRadius="4px"
              _hover={{ bg: "#2A2A38" }}
              cursor="pointer"
              onClick={() => deleteMsg(message.id)}
            >
              <HStack gap="6px">
                <Trash2 size={12} />
                <Text>Delete</Text>
              </HStack>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function MessageBody({ message }: { message: Message; isGrouped?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: editMsg, isPending } = useEditMessage(message.channelId);

  useEffect(() => {
    if (editing) {
      setDraft(message.body);
      inputRef.current?.focus();
    }
  }, [editing, message.body]);

  function save() {
    if (draft.trim() === message.body || draft.trim() === "") { setEditing(false); return; }
    editMsg({ messageId: message.id, body: draft.trim() }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <VStack gap="4px" alignItems="stretch" w="full">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === "Escape") setEditing(false);
          }}
          size="sm"
          bg="#16161F"
          border="1px solid #6C63FF"
          color="#F4F4F6"
          fontSize="14px"
          borderRadius="6px"
          _focusVisible={{ boxShadow: "0 0 0 1px #6C63FF" }}
          disabled={isPending}
        />
        <HStack gap="6px">
          <Button size="xs" bg="#6C63FF" color="white" _hover={{ bg: "#5A52E0" }} onClick={save} disabled={isPending}>
            Save
          </Button>
          <Button size="xs" variant="ghost" color="rgba(244,244,246,0.5)" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Text fontSize="11px" color="rgba(244,244,246,0.3)">Esc to cancel · Enter to save</Text>
        </HStack>
      </VStack>
    );
  }

  return (
    <HStack
      gap="6px"
      alignItems="flex-start"
      w="full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <HStack gap="4px" alignItems="baseline">
          <Text color="#D4D4DC" fontSize="14px" lineHeight="1.5" wordBreak="break-word">
            {message.body}
          </Text>
          {message.editedAt && (
            <Text color="rgba(244,244,246,0.25)" fontSize="11px" flexShrink={0}>(edited)</Text>
          )}
        </HStack>
        <ReactionArea message={message} />
      </VStack>
      {hovered && (
        <Box flexShrink={0}>
          <MessageActions message={message} onEdit={() => setEditing(true)} />
        </Box>
      )}
    </HStack>
  );
}

export function MessageRow({ message, prevAuthorId, authorUsername }: Props) {
  const isOnline = usePresenceStore((s) => s.onlineIds.has(message.authorId));

  if (prevAuthorId === message.authorId) {
    return (
      <Box pl="48px" pr="16px" _hover={{ bg: "#0E0E18" }} py="1px">
        <MessageBody message={message} isGrouped />
      </Box>
    );
  }

  return (
    <HStack gap="10px" alignItems="flex-start" px="16px" pt="8px" _hover={{ bg: "#0E0E18" }} py="4px">
      <Box position="relative" flexShrink={0} mt="2px">
        <Box
          w="32px"
          h="32px"
          borderRadius="8px"
          bg="#22222E"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="12px" fontWeight="700" color="#6C63FF">
            {authorUsername.slice(0, 2).toUpperCase()}
          </Text>
        </Box>
        {isOnline && (
          <Box
            position="absolute"
            bottom="-2px"
            right="-2px"
            w="9px"
            h="9px"
            borderRadius="full"
            bg="#22C55E"
            border="2px solid #0A0A10"
          />
        )}
      </Box>
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <HStack gap="8px">
          <Text color="#F4F4F6" fontSize="14px" fontWeight="600">
            {authorUsername}
          </Text>
          <Text color="rgba(244,244,246,0.35)" fontSize="11px">
            {formatTime(message.createdAt)}
          </Text>
        </HStack>
        <MessageBody message={message} isGrouped={false} />
      </VStack>
    </HStack>
  );
}
