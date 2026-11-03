import { VStack, Box, Text, Input } from "@chakra-ui/react";
import { useState } from "react";

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
    <VStack alignItems="stretch" gap="8px">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search people"
        size="sm"
        bg="#1C1C2E"
        border="1px solid #2E2E50"
        color="#F4F4F6"
        _placeholder={{ color: "rgba(244,244,246,0.3)" }}
        _focus={{ borderColor: "#6C63FF", boxShadow: "none" }}
      />
      <VStack alignItems="stretch" gap="2px" maxH="200px" overflow="auto">
        {visible.length === 0 && (
          <Text color="rgba(244,244,246,0.4)" fontSize="13px" px="4px">
            No one to add
          </Text>
        )}
        {visible.map((u) => {
          const checked = selected.includes(u.userId);
          return (
            <Box
              as="label"
              key={u.userId}
              display="flex"
              alignItems="center"
              gap="8px"
              px="6px"
              py="4px"
              borderRadius="6px"
              cursor="pointer"
              color="rgba(244,244,246,0.8)"
              fontSize="13px"
              _hover={{ bg: "rgba(255,255,255,0.04)" }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && selected.length >= max}
                onChange={() => toggle(u.userId)}
                style={{ accentColor: "#6C63FF" }}
              />
              {u.username}
            </Box>
          );
        })}
      </VStack>
      <Text color="rgba(244,244,246,0.35)" fontSize="11px">
        {selected.length} of up to {max} selected
      </Text>
    </VStack>
  );
}
