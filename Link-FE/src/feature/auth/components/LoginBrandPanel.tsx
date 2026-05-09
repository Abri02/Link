import { Box, Text } from "@chakra-ui/react";

const ACCENT = "#3B82F6";

function Decorations() {
  return (
    <Box position="absolute" top="0" left="0" right="0" bottom="0" overflow="hidden" pointerEvents="none">
      <Box
        position="absolute"
        top="-100px"
        left="-100px"
        w="420px"
        h="420px"
        borderRadius="full"
        border="1px solid rgba(244,244,246,0.035)"
      />
      <Box
        position="absolute"
        top="-30px"
        left="-30px"
        w="210px"
        h="210px"
        borderRadius="full"
        border="1px solid rgba(244,244,246,0.065)"
      />
      <Box
        position="absolute"
        top="30px"
        left="30px"
        w="80px"
        h="80px"
        borderRadius="full"
        border="1px solid rgba(59,130,246,0.18)"
      />
      <Box
        position="absolute"
        bottom="110px"
        right="44px"
        w="120px"
        h="120px"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.22) 1.5px, transparent 1.5px)",
          backgroundSize: "16px 16px",
        }}
      />
      <Box
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        h="1px"
        style={{ background: "linear-gradient(to right, rgba(59,130,246,0.55), transparent 70%)" }}
      />
    </Box>
  );
}

export function LoginBrandPanel() {
  return (
    <Box
      position="relative"
      bg="#070709"
      display={{ base: "none", md: "flex" }}
      flexDirection="column"
      justifyContent="space-between"
      p="52px"
      overflow="hidden"
      borderRight="1px solid #181822"
    >
      <Decorations />

      <Box position="relative" zIndex={1}>
        <Text fontSize="13px" fontWeight="800" letterSpacing="0.38em" textTransform="uppercase" color="#F4F4F6">
          Link
        </Text>
        <Box w="18px" h="2px" bg={ACCENT} mt="7px" borderRadius="1px" />
      </Box>

      <Box position="relative" zIndex={1}>
        <Text
          as="h1"
          fontSize="clamp(50px, 4.2vw, 74px)"
          fontWeight="900"
          lineHeight="0.97"
          color="#F4F4F6"
          letterSpacing="-0.035em"
          mb="22px"
        >
          Every<br />thing.<br />
          <span style={{ color: ACCENT }}>Con</span>nected.
        </Text>
        <Text fontSize="13.5px" color="rgba(244,244,246,0.3)" lineHeight="1.75" maxW="230px">
          Workspaces, channels, and real-time messaging — built for teams that move fast.
        </Text>
      </Box>

      <Text fontSize="11px" color="rgba(244,244,246,0.16)" position="relative" zIndex={1} letterSpacing="0.04em">
        © 2026 Link
      </Text>
    </Box>
  );
}
