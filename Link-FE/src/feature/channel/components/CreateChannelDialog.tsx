import { Box, Input, Button, Field } from "@chakra-ui/react";
import { useState } from "react";
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
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      <Field.Root>
        <Field.Label color="rgba(244,244,246,0.7)" fontSize="13px">
          Channel name
        </Field.Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. announcements"
          bg="#1C1C2E"
          border="1px solid #2E2E50"
          color="#F4F4F6"
          _placeholder={{ color: "rgba(244,244,246,0.3)" }}
          _focus={{ borderColor: "#6C63FF", boxShadow: "none" }}
          autoFocus
        />
        {error && (
          <Field.ErrorText color="#FF6B6B" fontSize="12px">
            {error.message}
          </Field.ErrorText>
        )}
      </Field.Root>
      <Box as="label" display="flex" alignItems="center" gap="8px" color="rgba(244,244,246,0.7)" fontSize="13px" cursor="pointer">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          style={{ accentColor: "#6C63FF" }}
        />
        Private (only people you add can see it)
      </Box>
      <Button
        type="submit"
        loading={isPending}
        bg="#6C63FF"
        color="white"
        _hover={{ bg: "#5B52E0" }}
        borderRadius="8px"
        h="36px"
        fontSize="13px"
      >
        Create channel
      </Button>
    </Box>
  );
}
