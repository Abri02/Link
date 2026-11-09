import { Box, Button, Field, NativeSelect } from "@chakra-ui/react";
import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { UpsellNotice } from "@/feature/billing/components/UpsellNotice";
import { isPlanLimitError } from "@/util/apiClient";
import { useInviteMember } from "../hooks/useInviteMember";
import type { InvitableRole } from "../api/workspace.types";

interface Props {
  workspaceId: number;
  onClose: () => void;
}

export function InviteMemberDialog({ workspaceId, onClose }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<InvitableRole>("MEMBER");
  const { mutate, isPending, error } = useInviteMember(workspaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    mutate({ identifier: identifier.trim(), role }, { onSuccess: onClose });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="4">
      <TextField
        label="Username or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="e.g. alice or alice@example.com"
        error={error && !isPlanLimitError(error) ? error.message : null}
        autoFocus
      />
      {isPlanLimitError(error) && <UpsellNotice workspaceId={workspaceId} message={error.message} />}

      <Field.Root>
        <Field.Label textStyle="label">Role</Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
          >
            <option value="MEMBER">Member</option>
            <option value="GUEST">Guest</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>

      <Button type="submit" loading={isPending}>
        Invite
      </Button>
    </Box>
  );
}
