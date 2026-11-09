import { VStack, Text, Input } from "@chakra-ui/react";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";

interface PickableUser {
  userId: number;
  username: string;
}

interface Props {
  users: PickableUser[];
  selected: number[];
  onChange: (selected: number[]) => void;
  /** How many users can be picked. */
  max: number;
}

/** Checkbox list of workspace members with a name filter. */
export function MemberPicker({ users, selected, onChange, max }: Props) {
  const [filter, setFilter] = useState("");
  const visible = users.filter((u) => u.username.toLowerCase().includes(filter.trim().toLowerCase()));

  const toggle = (userId: number) =>
    onChange(selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]);

  return (
    <VStack alignItems="stretch" gap="2">
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search people" />
      <VStack alignItems="stretch" gap="0.5" maxH="52" overflow="auto">
        {visible.length === 0 && (
          <Text color="fg.muted" textStyle="label" px="1">
            No one to add
          </Text>
        )}
        {visible.map((u) => {
          const checked = selected.includes(u.userId);
          return (
            <ListRow as="label" key={u.userId} cursor="pointer">
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && selected.length >= max}
                onChange={() => toggle(u.userId)}
              />
              {u.username}
            </ListRow>
          );
        })}
      </VStack>
      <Text color="fg.muted" textStyle="caption">
        {selected.length} of up to {max} selected
      </Text>
    </VStack>
  );
}
