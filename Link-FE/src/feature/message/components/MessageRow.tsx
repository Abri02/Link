import { useState } from "react";
import { Box, VStack, HStack, Text, Button, Popover, Portal, IconButton, Menu, Input, Image, Link } from "@chakra-ui/react";
import { Smile, MoreHorizontal, Pencil, Trash2, MessageSquare, FileText, Download } from "lucide-react";
import { attachmentContentUrl } from "../api/message.api";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
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
            borderColor={hasReacted ? "#6C63FF" : "#38385E"}
            bg={hasReacted ? "#2A2A55" : "#2A2A45"}
            color="#F4F4F6"
            fontSize="12px"
            h="22px"
            px="6px"
            _hover={{ borderColor: "#6C63FF", bg: "#2A2A48" }}
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
            _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
            h="22px"
            w="22px"
            minW="0"
            p="0"
            aria-label="Add reaction"
          >
            <Smile size={13} />
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content bg="#22223A" border="1px solid #38385E" borderRadius="8px" p="6px" w="auto">
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
                    _hover={{ bg: "#38385E" }}
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
  const openThread = useWorkspaceStore((s) => s.openThread);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const role = useMyWorkspaceRole(selectedWorkspaceId);
  const { mutate: deleteMsg } = useDeleteMessage(message.channelId);

  const isAuthor = message.authorId === currentUserId;
  // Owners and admins can moderate (delete) anyone's message. The backend enforces this too.
  const canDelete = isAuthor || role === "OWNER" || role === "ADMIN";
  const isReply = message.parentMessageId != null;

  return (
    <HStack gap="2px">
      {!isReply && (
        <IconButton
          size="xs"
          variant="ghost"
          color="rgba(244,244,246,0.3)"
          _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
          aria-label="Reply in thread"
          h="22px"
          w="22px"
          minW="0"
          onClick={() => openThread(message.id)}
        >
          <MessageSquare size={13} />
        </IconButton>
      )}
      {canDelete && (
      <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          size="xs"
          variant="ghost"
          color="rgba(244,244,246,0.3)"
          _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
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
          <Menu.Content bg="#22223A" border="1px solid #38385E" borderRadius="8px" p="4px" minW="120px">
            {isAuthor && (
            <Menu.Item
              value="edit"
              color="#F4F4F6"
              fontSize="13px"
              borderRadius="4px"
              _hover={{ bg: "#38385E" }}
              cursor="pointer"
              onClick={onEdit}
            >
              <HStack gap="6px">
                <Pencil size={12} />
                <Text>Edit</Text>
              </HStack>
            </Menu.Item>
            )}
            <Menu.Item
              value="delete"
              color="#FF6B6B"
              fontSize="13px"
              borderRadius="4px"
              _hover={{ bg: "#38385E" }}
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
      )}
    </HStack>
  );
}

function AttachmentPreview({ url, name, mime }: { url: string; name: string; mime: string }) {
  const isImage = mime.startsWith("image/");
  if (isImage) {
    return (
      <Box mt="4px" maxW="300px">
        <Image
          src={url}
          alt={name}
          borderRadius="6px"
          maxH="200px"
          objectFit="contain"
          cursor="pointer"
          onClick={() => window.open(url, "_blank")}
        />
      </Box>
    );
  }
  return (
    <HStack
      mt="4px"
      bg="#22223A"
      border="1px solid #2E2E50"
      borderRadius="8px"
      px="10px"
      py="8px"
      gap="8px"
      maxW="280px"
    >
      <FileText size={18} color="#6C63FF" />
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <Text fontSize="13px" color="#D4D4DC" lineClamp={1}>{name}</Text>
      </VStack>
      <Link href={url} download={name} target="_blank" rel="noreferrer">
        <IconButton size="xs" variant="ghost" color="rgba(244,244,246,0.4)" _hover={{ color: "#F4F4F6" }} aria-label="Download" h="20px" w="20px" minW="0">
          <Download size={13} />
        </IconButton>
      </Link>
    </HStack>
  );
}

function MessageBody({ message }: { message: Message; isGrouped?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const { mutate: editMsg, isPending } = useEditMessage(message.channelId);
  const openThread = useWorkspaceStore((s) => s.openThread);

  function save() {
    if (draft.trim() === message.body || draft.trim() === "") { setEditing(false); return; }
    editMsg({ messageId: message.id, body: draft.trim() }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <VStack gap="4px" alignItems="stretch" w="full">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === "Escape") setEditing(false);
          }}
          size="sm"
          bg="#2A2A45"
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

  const hasThread = message.parentMessageId == null && message.replyCount > 0;

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
        {message.attachmentId != null && (
          <AttachmentPreview
            url={attachmentContentUrl(message.attachmentId)}
            name={message.attachmentName ?? "file"}
            mime={message.attachmentMime ?? "application/octet-stream"}
          />
        )}
        <ReactionArea message={message} />
        {hasThread && (
          <Button
            size="xs"
            variant="ghost"
            color="#7C74FF"
            fontSize="12px"
            fontWeight="500"
            h="20px"
            px="6px"
            mt="2px"
            borderRadius="4px"
            _hover={{ bg: "#2A2A48", color: "#9B94FF" }}
            onClick={() => openThread(message.id)}
          >
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </Button>
        )}
      </VStack>
      {hovered && (
        <Box flexShrink={0}>
          <MessageActions message={message} onEdit={() => { setDraft(message.body); setEditing(true); }} />
        </Box>
      )}
    </HStack>
  );
}

/** Conversation events (join, leave, rename): muted, centered, no actions. */
function SystemMessageRow({ message }: { message: Message }) {
  return (
    <Box px="16px" py="6px" textAlign="center">
      <Text as="span" color="rgba(244,244,246,0.4)" fontSize="12px" fontStyle="italic">
        {message.body}
      </Text>
      <Text as="span" color="rgba(244,244,246,0.25)" fontSize="11px" ml="6px">
        {formatTime(message.createdAt)}
      </Text>
    </Box>
  );
}

export function MessageRow({ message, prevAuthorId, authorUsername }: Props) {
  const isOnline = usePresenceStore((s) => s.onlineIds.has(message.authorId));

  if (message.type === "SYSTEM") return <SystemMessageRow message={message} />;

  if (prevAuthorId === message.authorId) {
    return (
      <Box pl="48px" pr="16px" _hover={{ bg: "#25253E" }} py="1px">
        <MessageBody message={message} isGrouped />
      </Box>
    );
  }

  return (
    <HStack gap="10px" alignItems="flex-start" px="16px" pt="8px" _hover={{ bg: "#25253E" }} py="4px">
      <Box position="relative" flexShrink={0} mt="2px">
        <Box
          w="32px"
          h="32px"
          borderRadius="8px"
          bg="#2E2E50"
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
            border="2px solid #1C1C2E"
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
