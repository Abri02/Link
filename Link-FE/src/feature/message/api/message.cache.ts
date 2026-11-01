import type { Message } from "./message.types";

/**
 * Appends a message to a cached list unless it is already there.
 * A sent message can arrive twice (mutation response + STOMP broadcast), in either order.
 */
export const appendMessage = (old: Message[] | undefined, message: Message): Message[] => {
  if (!old) return [message];
  return old.some((m) => m.id === message.id) ? old : [...old, message];
};
