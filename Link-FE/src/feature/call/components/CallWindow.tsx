import { useEffect, useRef, useState } from "react";
import { Box, chakra, HStack, Text } from "@chakra-ui/react";
import { Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { Tip } from "@/components/Tip";
import { callControlRecipe, callWindowRecipe } from "@/theme/recipes";
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

const CallPanel = chakra("div", callWindowRecipe);
const CallControl = chakra("button", callControlRecipe);

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
      style={{ width: "100%", height: "100%", objectFit: fit }}
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
    <CallPanel
      role="region"
      aria-label="Call"
      position="fixed"
      right="6"
      bottom="6"
      zIndex={1400}
      w="420px"
      maxW="calc(100vw - 32px)"
    >
      <Box position="relative" w="full" aspectRatio={4 / 3} bg="overlay.video">
        {/* "contain" so a shared screen isn't cropped. */}
        {status === "connected" && <StreamVideo stream={remoteStream} label="Remote video" fit="contain" />}
        {status !== "connected" && (
          <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center">
            <Text textStyle="body" color="overlay.muted">
              {statusText}
            </Text>
          </Box>
        )}
        {live && (
          <Box
            position="absolute"
            right="2.5"
            bottom="2.5"
            w="32"
            aspectRatio={4 / 3}
            bg="overlay.video"
            borderWidth="1px"
            borderColor="overlay.border"
            borderRadius="l1"
            overflow="hidden"
          >
            <StreamVideo stream={screenStream ?? localStream} muted label="Your video" fit={sharing ? "contain" : "cover"} />
          </Box>
        )}
      </Box>

      {endReason === "premium-required" && (
        // A themed strip: the notice's error and link colours are chosen for theme surfaces, not the dark window.
        <Box px="3.5" py="2.5" bg="bg.panel">
          <UpsellNotice workspaceId={workspaceId} message="Upgrade this workspace to make video calls." />
        </Box>
      )}

      <HStack w="full" px="3.5" py="2.5" gap="2">
        <Text flex="1" textStyle="label" truncate data-testid="call-status">
          {statusText}
        </Text>
        {live && (
          <>
            <Tip label={micOff ? "Unmute" : "Mute"} placement="top">
              <CallControl
                aria-label="Mute microphone"
                aria-pressed={micOff}
                tone={micOff ? "danger" : undefined}
                onClick={() => setMicOff((v) => !v)}
              >
                {micOff ? <MicOff size={16} /> : <Mic size={16} />}
              </CallControl>
            </Tip>
            <Tip label={cameraOff ? "Turn camera on" : "Turn camera off"} placement="top">
              <CallControl
                aria-label="Turn off camera"
                aria-pressed={cameraOff}
                tone={cameraOff ? "danger" : undefined}
                onClick={() => setCameraOff((v) => !v)}
              >
                {cameraOff ? <VideoOff size={16} /> : <Video size={16} />}
              </CallControl>
            </Tip>
            {canShare && (
              <Tip label={sharing ? "Stop sharing" : "Share screen"} placement="top">
                <CallControl
                  aria-label="Share screen"
                  aria-pressed={sharing}
                  tone={sharing ? "active" : undefined}
                  onClick={() => controls?.toggleScreenShare()}
                >
                  {sharing ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
                </CallControl>
              </Tip>
            )}
            <CallControl aria-label="Hang up" tone="hangup" onClick={() => controls?.hangUp()}>
              <PhoneOff size={16} />
            </CallControl>
          </>
        )}
      </HStack>
    </CallPanel>
  );
}
