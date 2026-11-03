import { VStack, Box, HStack, Text, NativeSelect } from "@chakra-ui/react";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import type { MemberDetail, WorkspaceRole } from "@/feature/workspace/api/workspace.types";

const ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];

interface Props {
  members: MemberDetail[];
  onStartDm?: (userId: number) => void;
  /** Only passed for owners: shows a role dropdown next to every member. */
  onChangeRole?: (userId: number, role: WorkspaceRole) => void;
  roleError?: string | null;
}

export function MemberList({ members, onStartDm, onChangeRole, roleError }: Props) {
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
      {roleError && (
        <Text color="#FF6B6B" fontSize="12px" px="16px" mb="2px" role="alert">
          {roleError}
        </Text>
      )}
      {members.map((m) => {
        const online = onlineIds.has(m.userId);
        return (
          <HStack
            key={m.userId}
            gap="4px"
            mx="6px"
            pr="4px"
            borderRadius="6px"
            _hover={{ bg: "rgba(255,255,255,0.04)" }}
          >
            <HStack
              as={onStartDm ? "button" : "div"}
              flex="1"
              minW="0"
              gap="8px"
              px="6px"
              py="3px"
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
            {onChangeRole && (
              <NativeSelect.Root size="xs" w="auto" flexShrink={0}>
                <NativeSelect.Field
                  aria-label={`Role for ${m.username}`}
                  value={m.role}
                  onChange={(e) => onChangeRole(m.userId, e.target.value as WorkspaceRole)}
                  bg="transparent"
                  border="1px solid #2E2E50"
                  color="rgba(244,244,246,0.6)"
                  borderRadius="4px"
                  fontSize="11px"
                  h="20px"
                  cursor="pointer"
                  style={{ outline: "none" }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} style={{ background: "#1C1C30" }}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            )}
          </HStack>
        );
      })}
    </VStack>
  );
}
