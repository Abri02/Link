import { apiClient } from "@/util/apiClient";
import type { Workspace, CreateWorkspaceRequest, AddMemberRequest, WorkspaceMember, MemberDetail } from "./workspace.types";

export const listWorkspaces = (): Promise<Workspace[]> =>
  apiClient("/workspaces");

export const createWorkspace = (data: CreateWorkspaceRequest): Promise<Workspace> =>
  apiClient("/workspaces", { method: "POST", body: JSON.stringify(data) });

export const addMember = (workspaceId: number, data: AddMemberRequest): Promise<WorkspaceMember> =>
  apiClient(`/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify(data) });

export const listMembers = (workspaceId: number): Promise<MemberDetail[]> =>
  apiClient(`/workspaces/${workspaceId}/members`);
