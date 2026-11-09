import { Hash, Lock } from "lucide-react";
import { NavItem } from "@/components/ui/NavItem";
import { CountBadges } from "@/feature/notification/components/CountBadges";
import { useHasUnread } from "@/feature/notification/stores/notificationStore";
import type { Channel } from "../api/channel.types";

interface Props {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}

export function ChannelItem({ channel, isSelected, onClick }: Props) {
  const unread = useHasUnread(channel.id);

  return (
    <NavItem
      onClick={onClick}
      selected={isSelected}
      unread={unread}
      icon={channel.kind === "PRIVATE" ? <Lock size={14} strokeWidth={1.5} /> : <Hash size={14} strokeWidth={1.5} />}
      trailing={!isSelected && <CountBadges channelId={channel.id} />}
    >
      {channel.name}
    </NavItem>
  );
}
