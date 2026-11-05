import { IconButton } from "@chakra-ui/react";
import { Video } from "lucide-react";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { otherMembers, type Conversation } from "@/feature/channel/api/channel.types";
import { Tip } from "@/components/Tip";
import { useCallStore } from "../stores/callStore";

/** "Call" button in a 1-on-1 DM header. Group DMs and channels have no calls (P2P only). */
export function CallButton({ conversation }: { conversation: Conversation }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const status = useCallStore((s) => s.status);
  const controls = useCallStore((s) => s.controls);

  const peer = otherMembers(conversation, currentUserId)[0];
  if (conversation.kind !== "DM" || !peer) return null;

  const busy = status === "calling" || status === "ringing" || status === "connected";

  return (
    <Tip label={busy ? "Already in a call" : `Call ${peer.username}`} placement="bottom">
      <IconButton
        size="xs"
        variant="ghost"
        color="rgba(244,244,246,0.5)"
        _hover={{ color: "#F4F4F6", bg: "#2A2A48" }}
        aria-label="Start call"
        disabled={!controls || busy}
        onClick={() => controls?.startCall(conversation.id, peer.userId)}
      >
        <Video size={14} />
      </IconButton>
    </Tip>
  );
}
