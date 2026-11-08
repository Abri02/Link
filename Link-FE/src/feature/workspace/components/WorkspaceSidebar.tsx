import { VStack, Box, Spinner, Dialog, Portal } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { useDisclosure } from "@chakra-ui/react";
import { Tip } from "@/components/Tip";
import { SidebarAction } from "@/components/ui/SidebarAction";
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { WorkspaceAvatar } from "./WorkspaceAvatar";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

export function WorkspaceSidebar() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const selectedId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const { open, onOpen, onClose } = useDisclosure();

  return (
    <VStack
      w="16"
      minH="100vh"
      bg="sidebar.bg"
      borderRightWidth="1px"
      borderColor="sidebar.border"
      py="3"
      gap="2"
      alignItems="center"
    >
      {isLoading && <Spinner size="sm" color="sidebar.muted" />}

      {workspaces?.map((ws) => (
        <WorkspaceAvatar
          key={ws.id}
          workspace={ws}
          isSelected={ws.id === selectedId}
          onClick={() => selectWorkspace(ws.id)}
        />
      ))}

      <Box mt="auto">
        <Tip label="Create workspace" placement="right">
          <SidebarAction
            label="Create workspace"
            onClick={onOpen}
            w="10"
            h="10"
            borderRadius="l2"
            borderWidth="1px"
            borderColor="sidebar.border"
          >
            <Plus size={16} />
          </SidebarAction>
        </Tip>
      </Box>

      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="360px" w="full">
              <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="16px">
                New workspace
              </Dialog.Title>
              <CreateWorkspaceDialog onClose={onClose} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
