import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { useCreateWorkspace } from "../hooks/useCreateWorkspace";

interface Props {
  onClose: () => void;
}

export function CreateWorkspaceDialog({ onClose }: Props) {
  const [name, setName] = useState("");
  const { mutate, isPending, error } = useCreateWorkspace();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutate({ name: name.trim() }, { onSuccess: onClose });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="4">
      <TextField
        label="Workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. My Company"
        error={error?.message}
        autoFocus
      />
      <Button type="submit" loading={isPending}>
        Create workspace
      </Button>
    </Box>
  );
}
