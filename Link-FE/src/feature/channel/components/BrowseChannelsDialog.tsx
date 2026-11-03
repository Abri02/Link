import { Box, Button, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { Hash } from "lucide-react";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useBrowseChannels, useJoinChannel } from "../hooks/useChannelMembership";

interface Props {
  workspaceId: number;
  onClose: () => void;
}

/** Public channels the user isn't in yet. Joining one opens it. */
export function BrowseChannelsDialog({ workspaceId, onClose }: Props) {
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: channels, isLoading } = useBrowseChannels(workspaceId, true);
  const join = useJoinChannel(workspaceId);

  return (
    <VStack alignItems="stretch" gap="8px">
      {isLoading && <Spinner size="sm" color="#6C63FF" />}
      {!isLoading && channels?.length === 0 && (
        <Text color="rgba(244,244,246,0.4)" fontSize="13px">
          You're in every public channel
        </Text>
      )}
      <VStack alignItems="stretch" gap="2px" maxH="280px" overflow="auto">
        {channels?.map((ch) => (
          <HStack key={ch.id} px="6px" py="4px" borderRadius="6px" _hover={{ bg: "rgba(255,255,255,0.04)" }}>
            <Hash size={14} color="rgba(244,244,246,0.5)" />
            <Text color="#F4F4F6" fontSize="13px" flex="1" truncate>
              {ch.name}
            </Text>
            <Button
              size="xs"
              bg="#6C63FF"
              color="white"
              _hover={{ bg: "#5B52E0" }}
              borderRadius="6px"
              aria-label={`Join ${ch.name}`}
              loading={join.isPending && join.variables === ch.id}
              onClick={() =>
                join.mutate(ch.id, {
                  onSuccess: () => {
                    selectChannel(ch.id);
                    onClose();
                  },
                })
              }
            >
              Join
            </Button>
          </HStack>
        ))}
      </VStack>
      {join.error && (
        <Box color="#FF6B6B" fontSize="12px" role="alert">
          {join.error.message}
        </Box>
      )}
    </VStack>
  );
}
