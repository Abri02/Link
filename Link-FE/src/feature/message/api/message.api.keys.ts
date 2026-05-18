export const messageKeys = {
  all: ["messages"] as const,
  byChannel: (channelId: number) => [...messageKeys.all, channelId] as const,
  search: (channelId: number, q: string) => [...messageKeys.all, channelId, "search", q] as const,
  thread: (parentMessageId: number) => [...messageKeys.all, "thread", parentMessageId] as const,
};
