import { VStack, Box, Spinner, IconButton, Dialog, Portal } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { useDisclosure } from "@chakra-ui/react";
import { Tip } from "@/components/Tip";
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
      w="64px"
      minH="100vh"
      bg="#0A0A10"
      borderRight="1px solid #16161F"
      pt="12px"
      pb="12px"
      gap="8px"
      alignItems="center"
    >
      {isLoading && <Spinner size="sm" color="#6C63FF" />}

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
          <IconButton
            onClick={onOpen}
            size="sm"
            w="40px"
            h="40px"
            borderRadius="full"
            bg="transparent"
            border="1px dashed #2E2E40"
            color="rgba(244,244,246,0.4)"
            _hover={{ borderColor: "#6C63FF", color: "#6C63FF" }}
            aria-label="Create workspace"
          >
            <Plus size={16} />
          </IconButton>
        </Tip>
      </Box>

      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
          <Dialog.Positioner>
            <Dialog.Content bg="#12121A" border="1px solid #22222E" borderRadius="12px" p="24px" maxW="360px" w="full">
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
