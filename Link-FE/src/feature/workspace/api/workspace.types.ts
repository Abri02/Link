export interface Workspace {
  id: number;
  name: string;
  slug: string;
  ownerId: number;
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export interface ChangeRoleRequest {
  role: WorkspaceRole;
}

export interface AddMemberRequest {
  userId: number;
  role?: InvitableRole;
}

export interface WorkspaceMember {
  workspaceId: number;
  userId: number;
  role: string;
}

export interface MemberDetail {
  userId: number;
  username: string;
  role: string;
}

/** New members join as MEMBER or GUEST. ADMIN/OWNER are granted later with a role change. */
export type InvitableRole = "MEMBER" | "GUEST";

export interface InviteMemberRequest {
  identifier: string;
  role?: InvitableRole;
}
