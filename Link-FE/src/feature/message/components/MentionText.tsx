import { Text } from "@chakra-ui/react";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useWorkspaceMembers } from "@/feature/workspace/hooks/useWorkspaceMembers";
import { splitMentions } from "../mentions";

/** Message text with `@mentions` of workspace members highlighted. Mentions of the viewer stand out more. */
export function MentionText({ body }: { body: string }) {
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const me = useAuthStore((s) => s.user?.username);
  const segments = splitMentions(body, members?.map((m) => m.username) ?? []);

  return segments.map((seg, i) =>
    seg.mention ? (
      <Text
        as="span"
        key={i}
        data-mention={seg.mention}
        color={seg.mention === me ? "#FDE68A" : "#A5A0FF"}
        bg={seg.mention === me ? "rgba(245,158,11,0.18)" : "rgba(108,99,255,0.18)"}
        borderRadius="3px"
        px="2px"
        fontWeight="600"
      >
        {seg.text}
      </Text>
    ) : (
      seg.text
    )
  );
}
