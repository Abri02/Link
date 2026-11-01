import { Box, Input, Button, Field, NativeSelect } from "@chakra-ui/react";
import { useState } from "react";
import { useInviteMember } from "../hooks/useInviteMember";

interface Props {
  workspaceId: number;
  onClose: () => void;
}

export function InviteMemberDialog({ workspaceId, onClose }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN" | "GUEST">("MEMBER");
  const { mutate, isPending, error } = useInviteMember(workspaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    mutate({ identifier: identifier.trim(), role }, { onSuccess: onClose });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      <Field.Root>
        <Field.Label color="rgba(244,244,246,0.7)" fontSize="13px">
          Username or email
        </Field.Label>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="e.g. alice or alice@example.com"
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

      <Field.Root>
        <Field.Label color="rgba(244,244,246,0.7)" fontSize="13px">
          Role
        </Field.Label>
        <NativeSelect.Root>
        <NativeSelect.Field
          value={role}
          onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN" | "GUEST")}
          bg="#1C1C30"
          border="1px solid #2E2E50"
          color="#F4F4F6"
          borderRadius="6px"
          px="12px"
          h="40px"
          fontSize="14px"
          cursor="pointer"
          style={{ outline: "none" }}
        >
          <option value="MEMBER" style={{ background: "#1C1C30" }}>Member</option>
          <option value="ADMIN" style={{ background: "#1C1C30" }}>Admin</option>
          <option value="GUEST" style={{ background: "#1C1C30" }}>Guest</option>
        </NativeSelect.Field>
        </NativeSelect.Root>
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
        Invite
      </Button>
    </Box>
  );
}
