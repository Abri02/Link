import { Button, Dialog, HStack, Text } from "@chakra-ui/react";
import { Phone, PhoneOff } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { useCallStore } from "../stores/callStore";
import { usePeerName } from "../hooks/usePeerName";

/** Modal shown while someone is ringing us. Closing it rejects the call. */
export function IncomingCallDialog() {
  const status = useCallStore((s) => s.status);
  const channelId = useCallStore((s) => s.channelId);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const controls = useCallStore((s) => s.controls);
  const peerName = usePeerName(channelId, peerUserId);

  return (
    <AppDialog open={status === "ringing"} onClose={() => controls?.reject()} title="Incoming call" role="alertdialog">
      <Dialog.Description textStyle="body" color="fg.muted" mb="4">
        <Text as="span" color="fg" fontWeight="600">
          {peerName ?? "Someone"}
        </Text>{" "}
        is calling you…
      </Dialog.Description>
      <HStack justify="flex-end" gap="2" pb="2">
        <Button variant="outline" onClick={() => controls?.reject()}>
          <PhoneOff size={14} /> Decline
        </Button>
        <Button onClick={() => controls?.accept()}>
          <Phone size={14} /> Accept
        </Button>
      </HStack>
    </AppDialog>
  );
}
