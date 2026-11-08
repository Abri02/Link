import { useEffect, useRef, useState } from "react";
import { Box, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import { Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { Tip } from "@/components/Tip";
import { UpsellNotice } from "@/feature/billing/components/UpsellNotice";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import type { CallEndReason } from "../api/call.types";
import { useCallStore } from "../stores/callStore";
import { usePeerName } from "../hooks/usePeerName";

const END_TEXT: Record<CallEndReason, string> = {
  hangup: "Call ended",
  "remote-hangup": "Call ended",
  rejected: "Call declined",
  declined: "Call declined",
  "no-answer": "No answer",
  "media-error": "Camera or microphone unavailable",
  failed: "Connection failed",
  "premium-required": "Video calls need a Premium workspace",
};

function StreamVideo({
  stream,
  muted,
  label,
  fit = "cover",
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  fit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      aria-label={label}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: "100%", height: "100%", objectFit: fit, background: "#0E0E1A" }}
    />
  );
}

/** Floating window for our outgoing or active call. Shows the end reason briefly after it ends. */
export function CallWindow() {
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const endReason = useCallStore((s) => s.endReason);
  // We declined from the incoming dialog: there was never a call window.
  if (status === "idle" || status === "ringing" || (status === "ended" && endReason === "declined")) return null;
  // A new call starts with the mic and camera on again.
  return <ActiveCallWindow key={callId} />;
}

function ActiveCallWindow() {
  const status = useCallStore((s) => s.status);
  const channelId = useCallStore((s) => s.channelId);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const screenStream = useCallStore((s) => s.screenStream);
  const endReason = useCallStore((s) => s.endReason);
  const controls = useCallStore((s) => s.controls);
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const peerName = usePeerName(channelId, peerUserId) ?? "Unknown user";
  const [micOff, setMicOff] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  // Muting disables the tracks; the peer connection keeps sending (silence / black frames).
  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOff));
  }, [localStream, micOff]);
  useEffect(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
  }, [localStream, cameraOff]);

  const statusText =
    status === "calling" ? `Calling ${peerName}…` : status === "ended" ? END_TEXT[endReason ?? "hangup"] : peerName;
  const live = status === "calling" || status === "connected";
  const sharing = screenStream != null;
  const canShare = status === "connected" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  return (
    <VStack
      role="region"
      aria-label="Call"
      position="fixed"
      right="24px"
      bottom="24px"
      zIndex={1400}
      w="420px"
      maxW="calc(100vw - 32px)"
      bg="#1C1C30"
      border="1px solid #2E2E50"
      borderRadius="12px"
      boxShadow="0 12px 40px rgba(0,0,0,0.5)"
      overflow="hidden"
      gap="0"
    >
      <Box position="relative" w="full" aspectRatio={4 / 3} bg="#0E0E1A">
        {/* "contain" so a shared screen isn't cropped. */}
        {status === "connected" && <StreamVideo stream={remoteStream} label="Remote video" fit="contain" />}
        {status !== "connected" && (
          <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center">
            <Text color="rgba(244,244,246,0.6)" fontSize="14px">
              {statusText}
            </Text>
          </Box>
        )}
        {live && (
          <Box
            position="absolute"
            right="10px"
            bottom="10px"
            w="120px"
            aspectRatio={4 / 3}
            borderRadius="8px"
            overflow="hidden"
            border="1px solid #38385E"
          >
            <StreamVideo stream={screenStream ?? localStream} muted label="Your video" fit={sharing ? "contain" : "cover"} />
          </Box>
        )}
      </Box>

      {endReason === "premium-required" && (
        <Box w="full" px="14px" pt="10px">
          <UpsellNotice workspaceId={workspaceId} message="Upgrade this workspace to make video calls." />
        </Box>
      )}

      <HStack w="full" px="14px" py="10px" gap="8px">
        <Text flex="1" color="#F4F4F6" fontSize="13px" fontWeight="600" truncate data-testid="call-status">
          {statusText}
        </Text>
        {live && (
          <>
            <Tip label={micOff ? "Unmute" : "Mute"} placement="top">
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Mute microphone"
                aria-pressed={micOff}
                color={micOff ? "#FF6B6B" : "#F4F4F6"}
                _hover={{ bg: "#2A2A48" }}
                onClick={() => setMicOff((v) => !v)}
              >
                {micOff ? <MicOff size={16} /> : <Mic size={16} />}
              </IconButton>
            </Tip>
            <Tip label={cameraOff ? "Turn camera on" : "Turn camera off"} placement="top">
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Turn off camera"
                aria-pressed={cameraOff}
                color={cameraOff ? "#FF6B6B" : "#F4F4F6"}
                _hover={{ bg: "#2A2A48" }}
                onClick={() => setCameraOff((v) => !v)}
              >
                {cameraOff ? <VideoOff size={16} /> : <Video size={16} />}
              </IconButton>
            </Tip>
            {canShare && (
              <Tip label={sharing ? "Stop sharing" : "Share screen"} placement="top">
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Share screen"
                  aria-pressed={sharing}
                  color={sharing ? "#10B981" : "#F4F4F6"}
                  _hover={{ bg: "#2A2A48" }}
                  onClick={() => controls?.toggleScreenShare()}
                >
                  {sharing ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
                </IconButton>
              </Tip>
            )}
            <IconButton
              size="sm"
              aria-label="Hang up"
              bg="#E5484D"
              color="white"
              _hover={{ bg: "#CC3F44" }}
              onClick={() => controls?.hangUp()}
            >
              <PhoneOff size={16} />
            </IconButton>
          </>
        )}
      </HStack>
    </VStack>
  );
}
