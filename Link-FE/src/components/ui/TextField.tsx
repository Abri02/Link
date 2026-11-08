import { Field, Input, type InputProps } from "@chakra-ui/react";

interface Props extends InputProps {
  label: string;
  error?: string | null;
  helperText?: string;
}

export function TextField({ label, error, helperText, ...inputProps }: Props) {
  return (
    <Field.Root invalid={!!error}>
      <Field.Label textStyle="label">{label}</Field.Label>
      <Input {...inputProps} />
      {helperText && <Field.HelperText textStyle="caption">{helperText}</Field.HelperText>}
      {error && <Field.ErrorText textStyle="caption">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
