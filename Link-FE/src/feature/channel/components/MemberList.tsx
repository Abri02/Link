import { VStack, HStack, Text, NativeSelect } from "@chakra-ui/react";
import { X } from "lucide-react";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { SidebarAction } from "@/components/ui/SidebarAction";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";
import type { MemberDetail, WorkspaceRole } from "@/feature/workspace/api/workspace.types";

const ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];

interface Props {
  members: MemberDetail[];
  onStartDm?: (userId: number) => void;
  /** Only passed for owners: shows a role dropdown next to every member. */
  onChangeRole?: (userId: number, role: WorkspaceRole) => void;
  roleError?: string | null;
  /** Only passed for owners and admins: shows a remove button for members `canRemove` allows. */
  onRemove?: (member: MemberDetail) => void;
  canRemove?: (member: MemberDetail) => boolean;
}

export function MemberList({ members, onStartDm, onChangeRole, roleError, onRemove, canRemove }: Props) {
  const onlineIds = usePresenceStore((s) => s.onlineIds);

  if (members.length === 0) return null;

  return (
    <VStack gap="0" alignItems="stretch" py="2">
      <Text color="sidebar.muted" textStyle="caption" px="4" mb="1">
        Members — {members.length}
      </Text>
      {roleError && (
        <Text color="sidebar.fg" textStyle="caption" px="4" mb="1" role="alert">
          {roleError}
        </Text>
      )}
      {members.map((m) => {
        const online = onlineIds.has(m.userId);
        return (
          <HStack key={m.userId} gap="1" mx="1.5" pr="1" borderRadius="l1" _hover={{ bg: "sidebar.hover" }}>
            <HStack
              as={onStartDm ? "button" : "div"}
              flex="1"
              minW="0"
              gap="2"
              px="1.5"
              py="1"
              onClick={() => onStartDm?.(m.userId)}
              cursor={onStartDm ? "pointer" : "default"}
            >
              <PresenceDot online={online} />
              <Text color={online ? "sidebar.fg" : "sidebar.muted"} textStyle="label" truncate>
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
                  borderColor="sidebar.border"
                  color="sidebar.muted"
                  borderRadius="l1"
                  textStyle="caption"
                  h="5"
                  cursor="pointer"
                  focusRingColor="sidebar.fg"
                  css={{ "& option": { bg: "bg.panel", color: "fg" } }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            )}
            {onRemove && canRemove?.(m) && (
              <SidebarAction label={`Remove ${m.username}`} onClick={() => onRemove(m)} flexShrink={0}>
                <X size={12} />
              </SidebarAction>
            )}
          </HStack>
        );
      })}
    </VStack>
  );
}
