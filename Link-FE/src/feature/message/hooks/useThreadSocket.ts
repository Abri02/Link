import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "@/util/constants";
import { messageKeys } from "../api/message.api.keys";
import type { Message } from "../api/message.types";

export function useThreadSocket(parentMessageId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (parentMessageId == null) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/thread.${parentMessageId}`, (frame) => {
          const reply: Message = JSON.parse(frame.body);
          queryClient.setQueryData<Message[]>(messageKeys.thread(parentMessageId), (old) =>
            old ? [...old, reply] : [reply]
          );
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [parentMessageId, queryClient]);
}
