import { Box, Input, Button, Field, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useOpenConversation } from "../hooks/useOpenConversation";
import { MemberPicker } from "./MemberPicker";

/** People besides the current user. Matches the backend limit. */
export const MAX_OTHER_MEMBERS = 8;

interface Props {
  workspaceId: number;
  onClose: () => void;
}

/** Pick one person for a DM, or 2–8 for a group DM (with an optional name). */
export function NewMessageDialog({ workspaceId, onClose }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const { mutate, isPending, error } = useOpenConversation(workspaceId);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState("");

  const candidates = (members ?? []).filter((m) => m.userId !== currentUserId);
  const isGroup = selected.length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    mutate(
      { userIds: selected, title: isGroup && title.trim() ? title.trim() : undefined },
      {
        onSuccess: (conversation) => {
          selectChannel(conversation.id);
          onClose();
        },
      }
    );
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      <MemberPicker users={candidates} selected={selected} onChange={setSelected} max={MAX_OTHER_MEMBERS} />
      {isGroup && (
        <Field.Root>
          <Field.Label color="rgba(244,244,246,0.7)" fontSize="13px">
            Name (optional)
          </Field.Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Launch crew"
            maxLength={80}
            bg="#1C1C2E"
            border="1px solid #2E2E50"
            color="#F4F4F6"
            _placeholder={{ color: "rgba(244,244,246,0.3)" }}
            _focus={{ borderColor: "#6C63FF", boxShadow: "none" }}
          />
        </Field.Root>
      )}
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
        Start conversation
      </Button>
    </Box>
  );
}
