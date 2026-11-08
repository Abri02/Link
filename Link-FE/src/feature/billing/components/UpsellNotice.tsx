import { Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";

interface Props {
  workspaceId: number | null;
  message: string;
}

/** Shown when a Free plan limit is hit: the reason, plus a link to the pricing page. */
export function UpsellNotice({ workspaceId, message }: Props) {
  return (
    <Text color="#FF6B6B" fontSize="12px" role="alert">
      {message}
      {workspaceId != null && (
        <>
          {" "}
          <Link to={`/pricing?workspaceId=${workspaceId}`} style={{ color: "#A8A3FF", textDecoration: "underline" }}>
            See Premium
          </Link>
        </>
      )}
    </Text>
  );
}
