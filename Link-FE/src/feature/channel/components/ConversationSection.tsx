import { Box, Text, VStack } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { Tip } from "@/components/Tip";
import { SidebarAction } from "@/components/ui/SidebarAction";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useConversations } from "../hooks/useConversations";
import { ConversationItem } from "./ConversationItem";

interface Props {
  workspaceId: number;
  onNewMessageClick: () => void;
}

export function ConversationSection({ workspaceId, onNewMessageClick }: Props) {
  const selectedChannelId = useWorkspaceStore((s) => s.selectedChannelId);
  const selectChannel = useWorkspaceStore((s) => s.selectChannel);
  const { data: conversations } = useConversations(workspaceId);
  const role = useMyWorkspaceRole(workspaceId);

  // Guests can't start conversations (the backend returns 403), but they see the ones they were added to.
  const canStart = role !== "GUEST";
  if (!canStart && !conversations?.length) return null;

  return (
    <Box borderTopWidth="1px" borderColor="sidebar.border" flexShrink={0} py="2" position="relative">
      <Text color="sidebar.muted" textStyle="caption" px="4" mb="1">
        Direct messages
      </Text>
      {canStart && (
        <Tip label="New message">
          <SidebarAction label="New message" onClick={onNewMessageClick} position="absolute" top="1" right="2">
            <Plus size={13} />
          </SidebarAction>
        </Tip>
      )}
      <VStack gap="0.5" alignItems="stretch" px="1.5">
        {conversations?.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            isSelected={c.id === selectedChannelId}
            onClick={() => selectChannel(c.id)}
          />
        ))}
      </VStack>
    </Box>
  );
}
