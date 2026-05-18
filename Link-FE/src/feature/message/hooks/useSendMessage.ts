import { useMutation } from "@tanstack/react-query";
import { sendMessage } from "../api/message.api";
import type { SendMessageRequest } from "../api/message.types";

export const useSendMessage = (channelId: number) =>
  useMutation({
    mutationFn: (req: SendMessageRequest) => sendMessage(channelId, req),
  });
