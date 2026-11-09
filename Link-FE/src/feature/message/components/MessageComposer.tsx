import { HStack, VStack, IconButton } from "@chakra-ui/react";
import { Send, Paperclip } from "lucide-react";
import { useState, useRef, type KeyboardEvent } from "react";
import { useSendMessage } from "../hooks/useSendMessage";
import { uploadAttachment, type AttachmentResponse } from "../api/message.api";
import { useMentionCandidates } from "../hooks/useMentionCandidates";
import { activeMentionQuery } from "../mentions";
import { FormError } from "@/components/ui/FormError";
import { IconAction } from "@/components/ui/IconAction";
import { BareInput, InputBox } from "@/components/ui/InputBox";
import { UpsellNotice } from "@/feature/billing/components/UpsellNotice";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { isPlanLimitError } from "@/util/apiClient";
import { AttachmentPreview } from "./AttachmentPreview";
import { MentionPopup } from "./MentionPopup";

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
    <VStack gap="1.5" px="4" py="3" alignItems="stretch" position="relative">
      {suggesting && (
        <MentionPopup
          usernames={suggestions}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onPick={pickMention}
        />
      )}
      {uploadError != null &&
        (isPlanLimitError(uploadError) ? (
          <UpsellNotice workspaceId={workspaceId} message={uploadError.message} />
        ) : (
          <FormError>{uploadError instanceof Error ? uploadError.message : "Upload failed"}</FormError>
        ))}

      <InputBox flexDirection="column" alignItems="stretch">
        {attachment && (
          <AttachmentPreview
            name={attachment.filename}
            sizeBytes={attachment.sizeBytes}
            onRemove={() => setAttachment(null)}
          />
        )}
        <HStack gap="1">
          <input type="file" ref={fileInputRef} hidden onChange={onFileChange} />
          <IconAction
            label="Attach file"
            size="xs"
            loading={uploading}
            flexShrink={0}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={16} />
          </IconAction>

          <BareInput
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
            disabled={isPending || uploading}
          />

          <IconButton
            size="xs"
            aria-label="Send message"
            loading={isPending}
            disabled={!body.trim() && !attachment}
            flexShrink={0}
            onClick={submit}
          >
            <Send size={16} />
          </IconButton>
        </HStack>
      </InputBox>
    </VStack>
  );
}
