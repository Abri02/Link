import { useState } from "react";
import { Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useEditMessage } from "../hooks/useEditMessage";
import type { Message } from "../api/message.types";

export function MessageEditor({ message, onClose }: { message: Message; onClose: () => void }) {
  const [draft, setDraft] = useState(message.body);
  const { mutate: editMsg, isPending } = useEditMessage(message.channelId);

  function save() {
    const trimmed = draft.trim();
    if (trimmed === message.body || trimmed === "") {
      onClose();
      return;
    }
    editMsg({ messageId: message.id, body: trimmed }, { onSuccess: onClose });
  }

  return (
    <VStack gap="1" alignItems="stretch" w="full">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") onClose();
        }}
        disabled={isPending}
      />
      <HStack gap="1.5">
        <Button size="xs" onClick={save} disabled={isPending}>
          Save
        </Button>
        <Button size="xs" variant="ghost" color="fg.muted" onClick={onClose}>
          Cancel
        </Button>
        <Text textStyle="caption" color="fg.muted">
          Esc to cancel · Enter to save
        </Text>
      </HStack>
    </VStack>
  );
}
