import { useMutation } from "@tanstack/react-query";
import { sendMessage } from "../api/message.api";

export const useSendMessage = (channelId: number) =>
  useMutation({
    mutationFn: (body: string) => sendMessage(channelId, { body }),
  });
