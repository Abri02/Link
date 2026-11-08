import { useState } from "react";
import { Button, VisuallyHidden, type InputProps } from "@chakra-ui/react";
import { TextField } from "../../../components/ui/TextField";

export function PasswordField(props: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      label="Password"
      type={visible ? "text" : "password"}
      placeholder="••••••••"
      endElement={
        <Button type="button" variant="plain" size="xs" onClick={() => setVisible(!visible)}>
          {visible ? "Hide" : "Show"}
          <VisuallyHidden> password</VisuallyHidden>
        </Button>
      }
      {...props}
    />
  );
}
