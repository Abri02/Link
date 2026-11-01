import { HStack, VStack, Input, IconButton, Text } from "@chakra-ui/react";
import { Send, Paperclip, X } from "lucide-react";
import { useState, useRef, type KeyboardEvent } from "react";
import { useSendMessage } from "../hooks/useSendMessage";
import { uploadAttachment, type AttachmentResponse } from "../api/message.api";

interface Props {
  channelId: number;
  channelName: string;
  parentMessageId?: number;
}

export function MessageComposer({ channelId, channelName, parentMessageId }: Props) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<AttachmentResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: send, isPending } = useSendMessage(channelId);

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
        },
      }
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
    try {
      const result = await uploadAttachment(file, channelId);
      setAttachment(result);
    } catch {
      // upload failed silently — could add a toast here
    } finally {
      setUploading(false);
    }
  };

  return (
    <VStack gap="0" px="16px" py="12px" alignItems="stretch">
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
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message #${channelName}`}
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
