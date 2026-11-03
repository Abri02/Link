import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/util/constants";
import type { Message } from "../api/message.types";

interface TypingEvent {
  channelId: number;
  userId: number;
  username: string;
}

/** Send at most one typing event per this interval while the user keeps typing. */
const SEND_INTERVAL_MS = 3000;
/** Hide a user's indicator if no new typing event arrives within this time. */
const EXPIRE_MS = 5000;

/**
 * Typing indicator for one channel. `notifyTyping` publishes to `/app/typing` (throttled);
 * `typingUsers` lists the other users currently typing, each expiring 5 s after their last event
 * or as soon as their message arrives.
 */
export function useTypingIndicator(channelId: number | null, currentUserId: number | undefined) {
  const [typing, setTyping] = useState<Record<number, string>>({});
  const clientRef = useRef<Client | null>(null);
  const lastSentRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (channelId == null) return;
    const timers = timersRef.current;

    const remove = (userId: number) => {
      clearTimeout(timers.get(userId));
      timers.delete(userId);
      setTyping((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/channel.${channelId}.typing`, (frame) => {
          const event: TypingEvent = JSON.parse(frame.body);
          if (event.userId === currentUserId) return;
          setTyping((prev) => ({ ...prev, [event.userId]: event.username }));
          clearTimeout(timers.get(event.userId));
          timers.set(event.userId, setTimeout(() => remove(event.userId), EXPIRE_MS));
        });
        // A sent message ends that author's typing state right away.
        client.subscribe(`/topic/channel.${channelId}`, (frame) => {
          const message: Message = JSON.parse(frame.body);
          remove(message.authorId);
        });
      },
    });

    clientRef.current = client;
    lastSentRef.current = 0;
    client.activate();
    return () => {
      clientRef.current = null;
      client.deactivate();
      timers.forEach(clearTimeout);
      timers.clear();
      setTyping({});
    };
  }, [channelId, currentUserId]);

  const notifyTyping = useCallback(() => {
    const client = clientRef.current;
    if (channelId == null || !client?.connected) return;
    const now = Date.now();
    if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
    lastSentRef.current = now;
    client.publish({ destination: "/app/typing", body: JSON.stringify({ channelId }) });
  }, [channelId]);

  return { typingUsers: Object.values(typing), notifyTyping };
}

export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}
