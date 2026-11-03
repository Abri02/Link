import { Box, Button, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useAddConversationMembers } from "../hooks/useConversationActions";
import type { Conversation } from "../api/channel.types";
import { MemberPicker } from "./MemberPicker";
import { MAX_OTHER_MEMBERS } from "./NewMessageDialog";

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

/** Adding to a 1-on-1 opens a new group DM, so this switches to whatever the backend returns. */
export function AddPeopleDialog({ conversation, onClose }: Props) {
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: members } = useWorkspaceMembers(conversation.workspaceId);
  const { mutate, isPending, error } = useAddConversationMembers(conversation.workspaceId, conversation.id);
  const [selected, setSelected] = useState<number[]>([]);

  const inConversation = new Set(conversation.members.map((m) => m.userId));
  const candidates = (members ?? []).filter((m) => !inConversation.has(m.userId));
  const room = MAX_OTHER_MEMBERS + 1 - conversation.members.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    mutate(selected, {
      onSuccess: (updated) => {
        selectChannel(updated.id);
        onClose();
      },
    });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      {conversation.kind === "DM" && (
        <Text color="rgba(244,244,246,0.5)" fontSize="12px">
          This starts a new group conversation. The history stays in this DM.
        </Text>
      )}
      <MemberPicker users={candidates} selected={selected} onChange={setSelected} max={room} />
      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
      <Button
        type="submit"
        loading={isPending}
        disabled={selected.length === 0}
        bg="#6C63FF"
        color="white"
        _hover={{ bg: "#5B52E0" }}
        borderRadius="8px"
        h="36px"
        fontSize="13px"
      >
        Add people
      </Button>
    </Box>
  );
}
