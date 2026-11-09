import { Button, Center, Heading, VStack } from "@chakra-ui/react";
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
    <Center minH="100dvh" bg="bg" p={{ base: "6", md: "12" }}>
      <VStack w="full" maxW="xl" gap="5" align="stretch">
        <Heading as="h1" textStyle="title">
          {title}
        </Heading>
        {children}
        <Button variant="ghost" alignSelf="center" onClick={backToWorkspace}>
          Back to workspace
        </Button>
      </VStack>
    </Center>
  );
}
