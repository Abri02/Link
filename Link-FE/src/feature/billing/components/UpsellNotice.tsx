import { Link } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FormError } from "@/components/ui/FormError";

interface Props {
  workspaceId: number | null;
  message: string;
}

/** Shown when a Free plan limit is hit: the reason, plus a link to the pricing page. */
export function UpsellNotice({ workspaceId, message }: Props) {
  return (
    <FormError>
      {message}
      {workspaceId != null && (
        <>
          {" "}
          <Link asChild variant="underline">
            <RouterLink to={`/pricing?workspaceId=${workspaceId}`}>See Premium</RouterLink>
          </Link>
        </>
      )}
    </FormError>
  );
}
