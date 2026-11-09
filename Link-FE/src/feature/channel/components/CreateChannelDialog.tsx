import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { useCreateChannel } from "../hooks/useCreateChannel";

interface Props {
  workspaceId: number;
  onClose: () => void;
}

export function CreateChannelDialog({ workspaceId, onClose }: Props) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const { mutate, isPending, error } = useCreateChannel(workspaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutate({ name: name.trim(), kind: isPrivate ? "PRIVATE" : "PUBLIC" }, { onSuccess: onClose });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="4">
      <TextField
        label="Channel name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. announcements"
        error={error?.message}
        autoFocus
      />
      <Box as="label" display="flex" alignItems="center" gap="2" textStyle="label" cursor="pointer">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        Private (only people you add can see it)
      </Box>
      <Button type="submit" loading={isPending}>
        Create channel
      </Button>
    </Box>
  );
}
