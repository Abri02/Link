import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { TextField } from "@/components/ui/TextField";
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
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="4">
      <MemberPicker users={candidates} selected={selected} onChange={setSelected} max={MAX_OTHER_MEMBERS} />
      {isGroup && (
        <TextField
          label="Name (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Launch crew"
          maxLength={80}
        />
      )}
      {error && <FormError>{error.message}</FormError>}
      <Button type="submit" loading={isPending} disabled={selected.length === 0}>
        Start conversation
      </Button>
    </Box>
  );
}
