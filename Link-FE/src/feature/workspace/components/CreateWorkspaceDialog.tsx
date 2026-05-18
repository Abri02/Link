import { Box, Input, Button, Field } from "@chakra-ui/react";
import { useState } from "react";
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
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      <Field.Root>
        <Field.Label color="rgba(244,244,246,0.7)" fontSize="13px">
          Workspace name
        </Field.Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Company"
          bg="#1C1C30"
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
        Create workspace
      </Button>
    </Box>
  );
}
