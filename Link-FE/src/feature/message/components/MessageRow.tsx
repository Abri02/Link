import { useState, type FocusEvent } from "react";
import { Box, Button, Center, chakra, HStack, Text, VStack } from "@chakra-ui/react";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { messageRowRecipe } from "@/theme/recipes";
import { attachmentContentUrl } from "../api/message.api";
import type { Message } from "../api/message.types";
import { AttachmentView } from "./AttachmentView";
import { MentionText } from "./MentionText";
import { MessageActions } from "./MessageActions";
import { MessageEditor } from "./MessageEditor";
import { ReactionBar } from "./ReactionBar";

const Row = chakra("div", messageRowRecipe);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A row is active while hovered or while keyboard focus is inside it (or in its open menu). */
function useRowActive() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return {
    active: hovered || focused,
    rowProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: (e: FocusEvent<HTMLDivElement>) => {
        if (e.target.matches(":focus-visible")) setFocused(true);
      },
      onBlur: (e: FocusEvent<HTMLDivElement>) => {
        // The actions menu is portalled outside the row. Unmounting it here would close it.
        const next = e.relatedTarget;
        if (next instanceof Element && (e.currentTarget.contains(next) || next.closest('[role="menu"]'))) return;
        setFocused(false);
      },
    },
  };
}

function MessageBody({ message, showActions }: { message: Message; showActions: boolean }) {
  const [editing, setEditing] = useState(false);
  const openThread = useWorkspaceStore((s) => s.openThread);

  if (editing) return <MessageEditor message={message} onClose={() => setEditing(false)} />;

  const hasThread = message.parentMessageId == null && message.replyCount > 0;

  return (
    <HStack gap="1.5" alignItems="flex-start" w="full">
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <HStack gap="1" alignItems="baseline">
          <Text textStyle="body" color="fg" wordBreak="break-word">
            <MentionText body={message.body} />
          </Text>
          {message.editedAt && (
            <Text textStyle="caption" color="fg.muted" flexShrink={0}>
              (edited)
            </Text>
          )}
        </HStack>
        {message.attachmentId != null && (
          <AttachmentView
            url={attachmentContentUrl(message.attachmentId)}
            name={message.attachmentName ?? "file"}
            mime={message.attachmentMime ?? "application/octet-stream"}
          />
        )}
        <ReactionBar message={message} />
        {hasThread && (
          <Button size="2xs" variant="ghost" textStyle="caption" px="1.5" mt="0.5" onClick={() => openThread(message.id)}>
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </Button>
        )}
      </VStack>
      {showActions && (
        <Box flexShrink={0}>
          <MessageActions message={message} onEdit={() => setEditing(true)} />
        </Box>
      )}
    </HStack>
  );
}

/** Conversation events (join, leave, rename): muted, centered, no actions. */
function SystemMessageRow({ message }: { message: Message }) {
  return (
    <Box px="4" py="1.5" textAlign="center">
      <Text as="span" textStyle="caption" color="fg.muted" fontStyle="italic">
        {message.body}
      </Text>
      <Text as="span" textStyle="caption" color="fg.muted" ml="1.5">
        {formatTime(message.createdAt)}
      </Text>
    </Box>
  );
}

interface Props {
  message: Message;
  prevAuthorId?: number;
  authorUsername: string;
}

export function MessageRow({ message, prevAuthorId, authorUsername }: Props) {
  const isOnline = usePresenceStore((s) => s.onlineIds.has(message.authorId));
  const { active, rowProps } = useRowActive();

  if (message.type === "SYSTEM") return <SystemMessageRow message={message} />;

  if (prevAuthorId === message.authorId) {
    return (
      <Row grouped {...rowProps}>
        <MessageBody message={message} showActions={active} />
      </Row>
    );
  }

  return (
    <Row {...rowProps}>
      <Box position="relative" flexShrink={0} mt="0.5">
        <Center boxSize="8" borderRadius="l1" bg="bg.muted">
          <Text textStyle="caption" fontWeight="700" color="fg">
            {authorUsername.slice(0, 2).toUpperCase()}
          </Text>
        </Center>
        {isOnline && (
          <PresenceDot
            online
            position="absolute"
            bottom="-0.5"
            right="-0.5"
            boxSize="2.5"
            borderWidth="2px"
            borderColor="bg"
          />
        )}
      </Box>
      <VStack gap="0" alignItems="flex-start" flex="1" minW="0">
        <HStack gap="2" alignItems="baseline">
          <Text textStyle="body" fontWeight="600" color="fg">
            {authorUsername}
          </Text>
          <Text textStyle="caption" color="fg.muted">
            {formatTime(message.createdAt)}
          </Text>
        </HStack>
        <MessageBody message={message} showActions={active} />
      </VStack>
    </Row>
  );
}
