import { VStack, Box, HStack, Text } from "@chakra-ui/react";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import type { MemberDetail } from "@/feature/workspace/api/workspace.types";

interface Props {
  members: MemberDetail[];
  onStartDm?: (userId: number) => void;
}

export function MemberList({ members, onStartDm }: Props) {
  const onlineIds = usePresenceStore((s) => s.onlineIds);

  if (members.length === 0) return null;

  return (
    <VStack gap="0" alignItems="stretch" py="8px">
      <Text
        color="rgba(244,244,246,0.3)"
        fontSize="11px"
        fontWeight="600"
        letterSpacing="0.08em"
        px="16px"
        mb="2px"
      >
        MEMBERS — {members.length}
      </Text>
      {members.map((m) => {
        const online = onlineIds.has(m.userId);
        return (
          <HStack
            key={m.userId}
            as={onStartDm ? "button" : "div"}
            gap="8px"
            px="12px"
            py="3px"
            borderRadius="6px"
            mx="6px"
            w="calc(100% - 12px)"
            _hover={{ bg: "rgba(255,255,255,0.04)" }}
            onClick={() => onStartDm?.(m.userId)}
            cursor={onStartDm ? "pointer" : "default"}
          >
            <Box
              w="8px"
              h="8px"
              borderRadius="full"
              flexShrink={0}
              bg={online ? "#22C55E" : "rgba(244,244,246,0.15)"}
            />
            <Text
              color={online ? "rgba(244,244,246,0.8)" : "rgba(244,244,246,0.4)"}
              fontSize="13px"
              truncate
            >
              {m.username}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
