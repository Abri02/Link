import type { ComponentProps, ReactNode } from "react";
import { chakra, Text } from "@chakra-ui/react";
import { navItemRecipe } from "@/theme/recipes";

const Row = chakra("button", navItemRecipe);

interface Props extends ComponentProps<typeof Row> {
  icon?: ReactNode;
  trailing?: ReactNode;
}

export function NavItem({ icon, trailing, selected, children, ...props }: Props) {
  return (
    <Row type="button" selected={selected} aria-current={selected ? "true" : undefined} {...props}>
      {icon}
      <Text as="span" truncate flex="1">
        {children}
      </Text>
      {trailing}
    </Row>
  );
}
