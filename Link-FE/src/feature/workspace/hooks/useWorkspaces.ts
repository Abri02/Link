import { useQuery } from "@tanstack/react-query";
import { listWorkspaces } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";

export const useWorkspaces = () =>
  useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: listWorkspaces,
    staleTime: 1000 * 60,
  });
