import { IconButton, type IconButtonProps } from "@chakra-ui/react";

interface Props extends Omit<IconButtonProps, "aria-label"> {
  label: string;
}

/** Small ghost icon button. Spreads its props so it can be a Menu or Popover trigger. */
export function IconAction({ label, children, ...props }: Props) {
  return (
    <IconButton
      aria-label={label}
      size="2xs"
      variant="ghost"
      color="fg.muted"
      _hover={{ bg: "bg.muted", color: "fg" }}
      {...props}
    >
      {children}
    </IconButton>
  );
}
