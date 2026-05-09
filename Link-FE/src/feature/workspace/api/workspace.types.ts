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

export interface AddMemberRequest {
  userId: number;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
}

export interface WorkspaceMember {
  workspaceId: number;
  userId: number;
  role: string;
}
