import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkspace } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.list() }),
  });
};
