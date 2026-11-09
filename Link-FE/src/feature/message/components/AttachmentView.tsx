import { Box, HStack, Icon, Image, Link, Text } from "@chakra-ui/react";
import { Download, FileText } from "lucide-react";
import { IconAction } from "@/components/ui/IconAction";

export function AttachmentView({ url, name, mime }: { url: string; name: string; mime: string }) {
  if (mime.startsWith("image/")) {
    return (
      <Box mt="1" maxW="300px">
        <Image
          src={url}
          alt={name}
          borderRadius="l1"
          maxH="200px"
          objectFit="contain"
          cursor="pointer"
          onClick={() => window.open(url, "_blank")}
        />
      </Box>
    );
  }
  return (
    <HStack mt="1" gap="2" px="2.5" py="2" maxW="280px" bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="l2">
      <Icon as={FileText} boxSize="4" color="brand.fg" />
      <Text textStyle="label" color="fg" flex="1" minW="0" lineClamp={1}>
        {name}
      </Text>
      <Link href={url} download={name} target="_blank" rel="noreferrer">
        <IconAction label="Download">
          <Download size={14} />
        </IconAction>
      </Link>
    </HStack>
  );
}
