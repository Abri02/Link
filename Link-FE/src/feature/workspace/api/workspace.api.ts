import { apiClient } from "@/util/apiClient";
import type { Workspace, CreateWorkspaceRequest, AddMemberRequest, WorkspaceMember, MemberDetail, InviteMemberRequest, ChangeRoleRequest } from "./workspace.types";

export const listWorkspaces = (): Promise<Workspace[]> =>
  apiClient("/workspaces");

export const createWorkspace = (data: CreateWorkspaceRequest): Promise<Workspace> =>
  apiClient("/workspaces", { method: "POST", body: JSON.stringify(data) });

export const addMember = (workspaceId: number, data: AddMemberRequest): Promise<WorkspaceMember> =>
  apiClient(`/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify(data) });

export const listMembers = (workspaceId: number): Promise<MemberDetail[]> =>
  apiClient(`/workspaces/${workspaceId}/members`);

export const inviteMember = (workspaceId: number, data: InviteMemberRequest): Promise<WorkspaceMember> =>
  apiClient(`/workspaces/${workspaceId}/members/invite`, { method: "POST", body: JSON.stringify(data) });

export const changeMemberRole = (workspaceId: number, userId: number, data: ChangeRoleRequest): Promise<WorkspaceMember> =>
  apiClient(`/workspaces/${workspaceId}/members/${userId}`, { method: "PATCH", body: JSON.stringify(data) });
