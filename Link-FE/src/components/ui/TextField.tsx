import type { ReactNode } from "react";
import { Field, Input, InputGroup, type InputProps } from "@chakra-ui/react";

interface Props extends InputProps {
  label: string;
  error?: string | null;
  helperText?: string;
  endElement?: ReactNode;
}

export function TextField({ label, error, helperText, endElement, ...inputProps }: Props) {
  return (
    <Field.Root invalid={!!error}>
      <Field.Label textStyle="label">{label}</Field.Label>
      {endElement ? (
        <InputGroup endElement={endElement}>
          <Input {...inputProps} />
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
      {helperText && <Field.HelperText textStyle="caption">{helperText}</Field.HelperText>}
      {error && <Field.ErrorText textStyle="caption">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
