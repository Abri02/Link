import { Box, Button, HStack, IconButton, NativeSelect, Spinner, Text, VStack } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useState } from "react";
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
    <VStack alignItems="stretch" gap="12px">
      {isLoading && <Spinner size="sm" color="#6C63FF" />}
      <VStack alignItems="stretch" gap="2px" maxH="240px" overflow="auto" aria-label="Channel members">
        {members?.map((m) => (
          <HStack key={m.userId} px="6px" py="4px" borderRadius="6px" _hover={{ bg: "rgba(255,255,255,0.04)" }}>
            <Text color="#F4F4F6" fontSize="13px" flex="1" truncate>
              {m.username}
              {m.userId === currentUserId && (
                <Text as="span" color="rgba(244,244,246,0.4)">
                  {" "}
                  (you)
                </Text>
              )}
            </Text>
            {canManage && m.userId !== currentUserId && (
              <IconButton
                size="2xs"
                variant="ghost"
                color="rgba(244,244,246,0.4)"
                _hover={{ color: "#FF6B6B", bg: "transparent" }}
                aria-label={`Remove ${m.username} from channel`}
                onClick={() => remove.mutate(m.userId)}
              >
                <X size={12} />
              </IconButton>
            )}
          </HStack>
        ))}
      </VStack>

      {canManage && (
        <Box
          as="form"
          display="flex"
          gap="8px"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (!picked) return;
            add.mutate(Number(picked), { onSuccess: () => setPicked("") });
          }}
        >
          <NativeSelect.Root size="sm" flex="1">
            <NativeSelect.Field
              aria-label="Person to add"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              bg="#1C1C2E"
              border="1px solid #2E2E50"
              color="#F4F4F6"
            >
              <option value="" style={{ background: "#1C1C30" }}>Add someone…</option>
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId} style={{ background: "#1C1C30" }}>
                  {m.username}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Button
            type="submit"
            size="sm"
            disabled={!picked}
            loading={add.isPending}
            bg="#6C63FF"
            color="white"
            _hover={{ bg: "#5B52E0" }}
            borderRadius="6px"
          >
            Add
          </Button>
        </Box>
      )}

      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
    </VStack>
  );
}
