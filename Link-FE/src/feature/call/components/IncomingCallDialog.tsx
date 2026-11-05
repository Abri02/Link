import { Button, Dialog, HStack, Portal, Text } from "@chakra-ui/react";
import { Phone, PhoneOff } from "lucide-react";
import { useCallStore } from "../stores/callStore";
import { usePeerName } from "../hooks/usePeerName";

/** Modal shown while someone is ringing us. Closing it rejects the call. */
export function IncomingCallDialog() {
  const status = useCallStore((s) => s.status);
  const channelId = useCallStore((s) => s.channelId);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const controls = useCallStore((s) => s.controls);
  const peerName = usePeerName(channelId, peerUserId);
  const open = status === "ringing";

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && controls?.reject()} role="alertdialog">
      <Portal>
        <Dialog.Backdrop bg="rgba(0,0,0,0.7)" />
        <Dialog.Positioner>
          <Dialog.Content bg="#1C1C30" border="1px solid #2E2E50" borderRadius="12px" p="24px" maxW="340px" w="full">
            <Dialog.Title color="#F4F4F6" fontSize="16px" fontWeight="600" mb="6px">
              Incoming call
            </Dialog.Title>
            <Dialog.Description color="rgba(244,244,246,0.6)" fontSize="14px" mb="20px">
              <Text as="span" color="#F4F4F6" fontWeight="600">
                {peerName ?? "Someone"}
              </Text>{" "}
              is calling you…
            </Dialog.Description>
            <HStack justify="flex-end" gap="8px">
              <Button size="sm" bg="#E5484D" color="white" _hover={{ bg: "#CC3F44" }} onClick={() => controls?.reject()}>
                <PhoneOff size={14} /> Decline
              </Button>
              <Button size="sm" bg="#2EA043" color="white" _hover={{ bg: "#278A39" }} onClick={() => controls?.accept()}>
                <Phone size={14} /> Accept
              </Button>
            </HStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
