import { Box, Input, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";

interface LoginFormFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  icon: LucideIcon;
  autoComplete?: string;
}

export function LoginFormField({
  label,
  type,
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  autoComplete,
}: LoginFormFieldProps) {
  return (
    <Box width="100%">
      <Text
        fontSize="10px"
        fontWeight="700"
        color="rgba(244,244,246,0.4)"
        mb="8px"
        letterSpacing="0.12em"
        textTransform="uppercase"
        userSelect="none"
      >
        {label}
      </Text>
      <Box position="relative">
        <Box
          position="absolute"
          left="14px"
          top="50%"
          style={{ transform: "translateY(-50%)" }}
          color="rgba(244,244,246,0.25)"
          display="flex"
          alignItems="center"
          pointerEvents="none"
          zIndex={1}
        >
          <Icon size={15} />
        </Box>
        <Input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          variant="outline"
          paddingLeft="42px"
          height="46px"
          background="#121219"
          borderColor="#22222E"
          color="#F4F4F6"
          fontSize="14px"
          borderRadius="9px"
          _placeholder={{ color: "rgba(244,244,246,0.16)" }}
          _focus={{
            borderColor: "#3B82F6",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.18)",
            outline: "none",
          }}
          _hover={{ borderColor: "#3B3350" }}
        />
      </Box>
      {error && (
        <Text fontSize="12px" color="#F87171" mt="5px" letterSpacing="0.01em">
          {error}
        </Text>
      )}
    </Box>
  );
}
