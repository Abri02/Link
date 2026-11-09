import { Button, Spinner, Text, VStack } from "@chakra-ui/react";
import { Hash } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { ListRow } from "@/components/ui/ListRow";
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
    <VStack alignItems="stretch" gap="2">
      {isLoading && <Spinner size="sm" color="brand.solid" />}
      {!isLoading && channels?.length === 0 && (
        <Text color="fg.muted" textStyle="label">
          You're in every public channel
        </Text>
      )}
      <VStack alignItems="stretch" gap="0.5" maxH="72" overflow="auto">
        {channels?.map((ch) => (
          <ListRow key={ch.id}>
            <Hash size={14} />
            <Text flex="1" truncate>
              {ch.name}
            </Text>
            <Button
              size="xs"
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
          </ListRow>
        ))}
      </VStack>
      {join.error && <FormError>{join.error.message}</FormError>}
    </VStack>
  );
}
