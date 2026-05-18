import { HStack, Input, IconButton } from "@chakra-ui/react";
import { Send } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useSendMessage } from "../hooks/useSendMessage";

interface Props {
  channelId: number;
  channelName: string;
  parentMessageId?: number;
}

export function MessageComposer({ channelId, channelName, parentMessageId }: Props) {
  const [body, setBody] = useState("");
  const { mutate: send, isPending } = useSendMessage(channelId);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    send({ body: trimmed, parentMessageId }, { onSuccess: () => setBody("") });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <HStack px="16px" py="12px" gap="8px">
      <Input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Message #${channelName}`}
        bg="#22223A"
        border="1px solid #2E2E50"
        color="#F4F4F6"
        borderRadius="10px"
        fontSize="14px"
        _placeholder={{ color: "rgba(244,244,246,0.3)" }}
        _focus={{ borderColor: "#6C63FF", boxShadow: "none" }}
        _hover={{ borderColor: "#3A3A60" }}
        disabled={isPending}
      />
      <IconButton
        onClick={submit}
        loading={isPending}
        disabled={!body.trim()}
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
  );
}
