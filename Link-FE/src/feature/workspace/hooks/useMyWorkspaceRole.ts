import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWorkspaceMembers } from "./useWorkspaceMembers";

export function useMyWorkspaceRole(workspaceId: number | null) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const me = members?.find((m) => m.userId === currentUserId);
  return me?.role ?? null;
}
