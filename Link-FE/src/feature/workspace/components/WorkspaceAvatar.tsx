import { Box, Text } from "@chakra-ui/react";
import { Tip } from "@/components/Tip";
import type { Workspace } from "../api/workspace.types";

interface Props {
  workspace: Workspace;
  isSelected: boolean;
  onClick: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function WorkspaceAvatar({ workspace, isSelected, onClick }: Props) {
  return (
    <Tip label={workspace.name} placement="right">
      <Box
        as="button"
        onClick={onClick}
        w="40px"
        h="40px"
        borderRadius={isSelected ? "12px" : "full"}
        bg={isSelected ? "#6C63FF" : "#22222E"}
        display="flex"
        alignItems="center"
        justifyContent="center"
        transition="all 0.15s"
        _hover={{ borderRadius: "12px", bg: isSelected ? "#6C63FF" : "#2E2E40" }}
        outline="none"
        flexShrink={0}
      >
        <Text fontSize="13px" fontWeight="700" color="#F4F4F6" lineHeight="1">
          {initials(workspace.name)}
        </Text>
      </Box>
    </Tip>
  );
}
