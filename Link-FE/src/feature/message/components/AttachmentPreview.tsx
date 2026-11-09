import { HStack, Text } from "@chakra-ui/react";
import { X } from "lucide-react";
import { IconAction } from "@/components/ui/IconAction";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The file waiting to be sent, shown at the top of the composer. */
export function AttachmentPreview({ name, sizeBytes, onRemove }: { name: string; sizeBytes: number; onRemove: () => void }) {
  return (
    <HStack gap="1.5" px="1.5" pb="1" borderBottomWidth="1px" borderColor="border">
      <Text textStyle="caption" color="fg" flex="1" lineClamp={1}>
        {name}
      </Text>
      <Text textStyle="caption" color="fg.muted">
        {formatSize(sizeBytes)}
      </Text>
      <IconAction label="Remove attachment" onClick={onRemove}>
        <X size={12} />
      </IconAction>
    </HStack>
  );
}
