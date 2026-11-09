import { Box, Button, NativeSelect, Spinner, Text, VStack } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { IconAction } from "@/components/ui/IconAction";
import { ListRow } from "@/components/ui/ListRow";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { useAddChannelMember, useChannelMembers, useRemoveChannelMember } from "../hooks/useChannelMembership";
import type { Channel } from "../api/channel.types";

interface Props {
  channel: Channel;
  /** OWNER/ADMIN or the channel creator. Others only see the list. The backend enforces this. */
  canManage: boolean;
  currentUserId: number | undefined;
}

export function ChannelMembersDialog({ channel, canManage, currentUserId }: Props) {
  const { data: members, isLoading } = useChannelMembers(channel.id);
  const { data: workspaceMembers } = useWorkspaceMembers(channel.workspaceId);
  const add = useAddChannelMember(channel.id);
  const remove = useRemoveChannelMember(channel.id);
  const [picked, setPicked] = useState("");

  const inChannel = new Set(members?.map((m) => m.userId));
  const candidates = (workspaceMembers ?? []).filter((m) => !inChannel.has(m.userId));
  const error = add.error ?? remove.error;

  return (
    <VStack alignItems="stretch" gap="3">
      {isLoading && <Spinner size="sm" color="brand.solid" />}
      <VStack alignItems="stretch" gap="0.5" maxH="60" overflow="auto" aria-label="Channel members">
        {members?.map((m) => (
          <ListRow key={m.userId}>
            <Text flex="1" truncate>
              {m.username}
              {m.userId === currentUserId && (
                <Text as="span" color="fg.muted">
                  {" "}
                  (you)
                </Text>
              )}
            </Text>
            {canManage && m.userId !== currentUserId && (
              <IconAction label={`Remove ${m.username} from channel`} onClick={() => remove.mutate(m.userId)}>
                <X size={12} />
              </IconAction>
            )}
          </ListRow>
        ))}
      </VStack>

      {canManage && (
        <Box
          as="form"
          display="flex"
          gap="2"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (!picked) return;
            add.mutate(Number(picked), { onSuccess: () => setPicked("") });
          }}
        >
          <NativeSelect.Root size="sm" flex="1">
            <NativeSelect.Field aria-label="Person to add" value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">Add someone…</option>
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.username}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Button type="submit" disabled={!picked} loading={add.isPending}>
            Add
          </Button>
        </Box>
      )}

      {error && <FormError>{error.message}</FormError>}
    </VStack>
  );
}
