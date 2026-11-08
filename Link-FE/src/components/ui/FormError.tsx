import type { ReactNode } from "react";
import { Text } from "@chakra-ui/react";

export function FormError({ children }: { children: ReactNode }) {
  return (
    <Text role="alert" textStyle="caption" color="fg.error">
      {children}
    </Text>
  );
}
