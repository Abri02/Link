import { useSearchParams } from "react-router-dom";

/** The `workspaceId` query parameter of the billing pages, or null when it's missing or invalid. */
export function useBillingWorkspaceId(): number | null {
  const [params] = useSearchParams();
  const id = Number(params.get("workspaceId"));
  return Number.isInteger(id) && id > 0 ? id : null;
}
