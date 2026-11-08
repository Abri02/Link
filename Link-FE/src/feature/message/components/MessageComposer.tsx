import { HStack, VStack, Input, IconButton, Text, Box } from "@chakra-ui/react";
import { Send, Paperclip, X } from "lucide-react";
import { useState, useRef, type KeyboardEvent } from "react";
import { useSendMessage } from "../hooks/useSendMessage";
import { uploadAttachment, type AttachmentResponse } from "../api/message.api";
import { useMentionCandidates } from "../hooks/useMentionCandidates";
import { activeMentionQuery } from "../mentions";
import { UpsellNotice } from "@/feature/billing/components/UpsellNotice";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { isPlanLimitError } from "@/util/apiClient";

const MAX_SUGGESTIONS = 6;

interface Props {
  channelId: number;
  channelName: string;
  parentMessageId?: number;
  /** Overrides the default "Message #channel" placeholder, e.g. for DMs. */
  placeholder?: string;
  /** Called on every keystroke that changes the text; the caller throttles it. */
  onTyping?: () => void;
}

export function MessageComposer({ channelId, channelName, parentMessageId, placeholder, onTyping }: Props) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<AttachmentResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: send, isPending } = useSendMessage(channelId);

  // @mention autocomplete: `mentionQuery` is the partial name before the caret (null = closed).
  const candidates = useMentionCandidates(channelId);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions =
    mentionQuery == null
      ? []
      : candidates
          .filter((m) => m.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS);
  const suggesting = suggestions.length > 0;

  const updateMentionQuery = (input: HTMLInputElement) => {
    const caret = input.selectionStart ?? input.value.length;
    setMentionQuery(activeMentionQuery(input.value.slice(0, caret)));
    setActiveIndex(0);
  };

  const pickMention = (username: string) => {
    const input = inputRef.current;
    const caret = input?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@[^@\s]*$/u, `@${username} `);
    const next = before + body.slice(caret);
    setBody(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(before.length, before.length);
    });
  };

  const submit = () => {
    const trimmed = body.trim();
    if ((!trimmed && !attachment) || isPending || uploading) return;
    send(
      {
        body: trimmed || (attachment ? attachment.filename : ""),
        parentMessageId,
        attachmentId: attachment?.id,
        attachmentName: attachment?.filename,
        attachmentMime: attachment?.mimeType,
      },
      {
        onSuccess: () => {
          setBody("");
          setAttachment(null);
          setMentionQuery(null);
        },
      }
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggesting) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(suggestions[Math.min(activeIndex, suggestions.length - 1)].username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadAttachment(file, channelId);
      setAttachment(result);
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <VStack gap="0" px="16px" py="12px" alignItems="stretch" position="relative">
      {suggesting && (
        <Box
          role="listbox"
          aria-label="Mention suggestions"
          position="absolute"
          bottom="calc(100% - 8px)"
          left="72px"
          minW="220px"
          bg="#22223A"
          border="1px solid #2E2E50"
          borderRadius="8px"
          py="4px"
          zIndex={10}
          boxShadow="0 8px 24px rgba(0,0,0,0.4)"
        >
          {suggestions.map((m, i) => (
            <Box
              key={m.userId}
              role="option"
              aria-selected={i === activeIndex}
              px="10px"
              py="5px"
              cursor="pointer"
              fontSize="13px"
              color="#F4F4F6"
              bg={i === activeIndex ? "#2A2A48" : "transparent"}
              onMouseEnter={() => setActiveIndex(i)}
              // mousedown, not click, so the input keeps focus and its caret position.
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(m.username);
              }}
            >
              @{m.username}
            </Box>
          ))}
        </Box>
      )}
      {uploadError != null && (
        <Box pb="6px">
          {isPlanLimitError(uploadError) ? (
            <UpsellNotice workspaceId={workspaceId} message={uploadError.message} />
          ) : (
            <Text color="#FF6B6B" fontSize="12px" role="alert">
              {uploadError instanceof Error ? uploadError.message : "Upload failed"}
            </Text>
          )}
        </Box>
      )}
      {attachment && (
        <HStack
          bg="#22223A"
          border="1px solid #2E2E50"
          borderBottom="none"
          borderTopRadius="10px"
          px="10px"
          py="6px"
          gap="6px"
        >
          <Text fontSize="12px" color="#A0A0C0" flex="1" lineClamp={1}>
            {attachment.filename}
          </Text>
          <Text fontSize="11px" color="rgba(244,244,246,0.35)">
            {formatSize(attachment.sizeBytes)}
          </Text>
          <IconButton
            size="xs"
            variant="ghost"
            color="rgba(244,244,246,0.4)"
            _hover={{ color: "#F4F4F6" }}
            aria-label="Remove attachment"
            h="16px"
            w="16px"
            minW="0"
            onClick={() => setAttachment(null)}
          >
            <X size={11} />
          </IconButton>
        </HStack>
      )}

      <HStack gap="8px">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={onFileChange}
        />
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          loading={uploading}
          variant="ghost"
          color="rgba(244,244,246,0.4)"
          _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
          borderRadius="8px"
          h="40px"
          w="40px"
          aria-label="Attach file"
          flexShrink={0}
        >
          <Paperclip size={16} />
        </IconButton>

        <Input
          ref={inputRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            updateMentionQuery(e.target);
            if (e.target.value.trim()) onTyping?.();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End")
              updateMentionQuery(e.currentTarget);
          }}
          onClick={(e) => updateMentionQuery(e.currentTarget)}
          onBlur={() => setMentionQuery(null)}
          aria-autocomplete="list"
          aria-expanded={suggesting}
          placeholder={placeholder ?? `Message #${channelName}`}
          bg="#22223A"
          border="1px solid #2E2E50"
          color="#F4F4F6"
          borderRadius={attachment ? "0 0 10px 10px" : "10px"}
          fontSize="14px"
          _placeholder={{ color: "rgba(244,244,246,0.3)" }}
          _focus={{ borderColor: "#6C63FF", boxShadow: "none" }}
          _hover={{ borderColor: "#3A3A60" }}
          disabled={isPending || uploading}
        />

        <IconButton
          onClick={submit}
          loading={isPending}
          disabled={!body.trim() && !attachment}
          bg="#6C63FF"
          color="white"
          borderRadius="8px"
          h="40px"
          w="40px"
          _hover={{ bg: "#5B52E0" }}
          _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
          aria-label="Send message"
          flexShrink={0}
        >
          <Send size={16} />
        </IconButton>
      </HStack>
    </VStack>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
