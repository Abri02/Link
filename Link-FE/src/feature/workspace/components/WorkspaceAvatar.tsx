import { Center, Text } from "@chakra-ui/react";
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
      <Center
        as="button"
        aria-label={workspace.name}
        onClick={onClick}
        w="10"
        h="10"
        borderRadius="l2"
        bg={isSelected ? "brand.solid" : "sidebar.active"}
        _hover={isSelected ? undefined : { bg: "sidebar.hover" }}
        cursor="pointer"
        focusVisibleRing="outside"
        focusRingColor="sidebar.fg"
        flexShrink={0}
      >
        <Text textStyle="label" fontWeight="600" color={isSelected ? "brand.contrast" : "sidebar.fg"}>
          {initials(workspace.name)}
        </Text>
      </Center>
    </Tip>
  );
}
