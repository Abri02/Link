import { Box } from "@chakra-ui/react";

interface Props {
  usernames: { userId: number; username: string }[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (username: string) => void;
}

export function MentionPopup({ usernames, activeIndex, onHover, onPick }: Props) {
  return (
    <Box
      role="listbox"
      aria-label="Mention suggestions"
      position="absolute"
      bottom="calc(100% - 8px)"
      left="4"
      minW="56"
      py="1"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="l2"
      boxShadow="md"
      zIndex={10}
    >
      {usernames.map((m, i) => (
        <Box
          key={m.userId}
          role="option"
          aria-selected={i === activeIndex}
          px="2.5"
          py="1"
          cursor="pointer"
          textStyle="label"
          color="fg"
          bg={i === activeIndex ? "bg.muted" : "transparent"}
          onMouseEnter={() => onHover(i)}
          // mousedown, not click, so the input keeps focus and its caret position.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(m.username);
          }}
        >
          @{m.username}
        </Box>
      ))}
    </Box>
  );
}
