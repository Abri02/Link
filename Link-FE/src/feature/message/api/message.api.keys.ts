export const messageKeys = {
  all: ["messages"] as const,
  byChannel: (channelId: number) => [...messageKeys.all, channelId] as const,
};
