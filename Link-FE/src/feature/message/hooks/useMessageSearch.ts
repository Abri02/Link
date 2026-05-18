import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMessages } from "../api/message.api";
import { messageKeys } from "../api/message.api.keys";

export function useMessageSearch(channelId: number | null, query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  return useQuery({
    queryKey: messageKeys.search(channelId!, debouncedQuery),
    queryFn: () => searchMessages(channelId!, debouncedQuery),
    enabled: channelId != null && debouncedQuery.trim().length >= 2,
  });
}
