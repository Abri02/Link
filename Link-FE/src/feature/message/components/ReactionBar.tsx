import { useState } from "react";
import { Button, chakra, HStack, Popover, Portal } from "@chakra-ui/react";
import { Smile } from "lucide-react";
import { IconAction } from "@/components/ui/IconAction";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { reactionChipRecipe } from "@/theme/recipes";
import { useToggleReaction } from "../hooks/useToggleReaction";
import type { Message } from "../api/message.types";

const EMOJI_PICKER = ["👍", "❤️", "😂", "🎉", "🔥", "😮", "😢", "👀"];

const ReactionChip = chakra("button", reactionChipRecipe);

export function ReactionBar({ message }: { message: Message }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { mutate: toggleReaction } = useToggleReaction(message.channelId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasReactions = Object.keys(message.reactions).length > 0;

  function toggle(emoji: string) {
    if (currentUserId == null) return;
    const userIds = message.reactions[emoji] ?? [];
    const hasReacted = userIds.includes(currentUserId);
    toggleReaction({ messageId: message.id, emoji, hasReacted, currentUserId });
  }

  return (
    <HStack gap="1" flexWrap="wrap" mt={hasReactions ? "1" : "0"}>
      {Object.entries(message.reactions).map(([emoji, userIds]) => (
        <ReactionChip
          key={emoji}
          type="button"
          reacted={currentUserId != null && userIds.includes(currentUserId)}
          onClick={() => toggle(emoji)}
        >
          {emoji} {userIds.length}
        </ReactionChip>
      ))}

      <Popover.Root open={pickerOpen} onOpenChange={(e) => setPickerOpen(e.open)}>
        <Popover.Trigger asChild>
          <IconAction label="Add reaction">
            <Smile size={14} />
          </IconAction>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content w="auto" p="1.5" borderWidth="1px" borderColor="border" borderRadius="l2">
              <HStack gap="1">
                {EMOJI_PICKER.map((emoji) => (
                  <Button
                    key={emoji}
                    size="xs"
                    variant="ghost"
                    textStyle="title"
                    p="0"
                    onClick={() => {
                      toggle(emoji);
                      setPickerOpen(false);
                    }}
                  >
                    {emoji}
                  </Button>
                ))}
              </HStack>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </HStack>
  );
}
