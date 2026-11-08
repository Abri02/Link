import { Box, Heading, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";

interface Props {
  title: string;
  workspaceId: number;
  children: ReactNode;
}

export function BillingPageLayout({ title, workspaceId, children }: Props) {
  const navigate = useNavigate();

  // Coming back from Stripe reloads the app, so the selection has to be restored.
  const backToWorkspace = () => {
    const store = useWorkspaceStore.getState();
    if (store.selectedWorkspaceId !== workspaceId) store.selectWorkspace(workspaceId);
    navigate("/");
  };

  return (
    <Box minH="100vh" bg="#1C1C2E" display="flex" alignItems="center" justifyContent="center" p="16px">
      <VStack
        w="full"
        maxW="520px"
        bg="#1C1C30"
        border="1px solid #2E2E50"
        borderRadius="12px"
        p="24px"
        gap="20px"
        alignItems="stretch"
      >
        <Heading as="h1" color="#F4F4F6" fontSize="20px" fontWeight="600">
          {title}
        </Heading>
        {children}
        <Box
          as="button"
          onClick={backToWorkspace}
          color="#A8A3FF"
          fontSize="13px"
          cursor="pointer"
          _hover={{ textDecoration: "underline" }}
        >
          Back to workspace
        </Box>
      </VStack>
    </Box>
  );
}
