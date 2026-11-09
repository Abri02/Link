import { useEffect, useRef, useState } from "react";
import { Box, Center, chakra, HStack, Text, VStack } from "@chakra-ui/react";
import { Expand, Maximize, Mic, MicOff, Minimize, MonitorOff, MonitorUp, PhoneOff, Shrink, Video, VideoOff } from "lucide-react";
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
  failed: "Connection failed",
  "premium-required": "Video calls need a Premium workspace",
};

const CallPanel = chakra("div", callWindowRecipe);
const CallControl = chakra("button", callControlRecipe);

const SMALL_PANEL = { right: "6", bottom: "6", w: "420px", maxW: "calc(100vw - 32px)" } as const;
const EXPANDED_PANEL = { inset: { base: "0", md: "4" }, display: "flex", flexDirection: "column" } as const;

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
  const endReason = useCallStore((s) => s.endReason);
  const callId = useCallStore((s) => s.callId);
  // We declined from the incoming dialog: there was never a call window.
  if (status === "idle" || status === "ringing" || (status === "ended" && endReason === "declined")) return null;
  // Keyed so every call starts small, even one placed while the last call's end text is showing.
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
  const micOn = useCallStore((s) => s.micOn);
  const cameraOn = useCallStore((s) => s.cameraOn);
  const peerMicOn = useCallStore((s) => s.peerMicOn);
  const peerCameraOn = useCallStore((s) => s.peerCameraOn);
  const deviceError = useCallStore((s) => s.deviceError);

  const statusText =
    status === "calling" ? `Calling ${peerName}…` : status === "ended" ? END_TEXT[endReason ?? "hangup"] : peerName;
  const live = status === "calling" || status === "connected";
  const sharing = screenStream != null;
  const canShare = status === "connected" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const big = live && (expanded || fullscreen);

  // Follows the browser, because Esc leaves fullscreen without going through our button.
  useEffect(() => {
    const onChange = () => setFullscreen(panelRef.current != null && document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // The controls are gone once the call ends, so don't leave the user stuck in fullscreen.
  useEffect(() => {
    if (!live && panelRef.current && document.fullscreenElement === panelRef.current) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [live]);

  const toggleFullscreen = () => {
    if (fullscreen) void document.exitFullscreen().catch(() => {});
    else void panelRef.current?.requestFullscreen().catch(() => {});
  };

  return (
    <CallPanel
      ref={panelRef}
      role="region"
      aria-label="Call"
      position="fixed"
      zIndex={1400}
      {...(big ? EXPANDED_PANEL : SMALL_PANEL)}
    >
      {/* The same elements in every size: remounting the remote <video> would interrupt the audio. */}
      <Box
        position="relative"
        w="full"
        flex={big ? "1" : undefined}
        minH="0"
        aspectRatio={big ? undefined : 4 / 3}
        bg="overlay.video"
      >
        {/* "contain" so a shared screen isn't cropped. */}
        {status === "connected" && <StreamVideo stream={remoteStream} label="Remote video" fit="contain" />}
        {/* Covers the video rather than replacing it: the <video> also plays the remote audio. */}
        {status === "connected" && !peerCameraOn && (
          <VStack data-testid="peer-camera-off" position="absolute" inset="0" justify="center" gap="2" bg="overlay.video">
            <Center w="16" h="16" borderRadius="l2" bg="overlay.hover" aria-hidden>
              <Text textStyle="title" color="overlay.fg">
                {peerName.slice(0, 2).toUpperCase()}
              </Text>
            </Center>
            <Text textStyle="body" color="overlay.muted">
              {peerName}
            </Text>
          </VStack>
        )}
        {status === "connected" && !peerMicOn && (
          <Center
            role="img"
            aria-label={`${peerName} is muted`}
            position="absolute"
            left="2.5"
            top="2.5"
            w="7"
            h="7"
            borderRadius="l1"
            bg="overlay.panel"
            color="overlay.danger"
          >
            <MicOff size={14} />
          </Center>
        )}
        {status !== "connected" && (
          <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center">
            <Text textStyle="body" color="overlay.muted">
              {statusText}
            </Text>
          </Box>
        )}
        {live && (cameraOn || sharing) && (
          <Box
            position="absolute"
            right="2.5"
            bottom="2.5"
            w={big ? { base: "32", md: "64" } : "32"}
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

      {live && deviceError && (
        <Text role="alert" px="3.5" pt="2.5" textStyle="caption" color="overlay.danger">
          {deviceError}
        </Text>
      )}

      <HStack w="full" px="3.5" py="2.5" gap="2">
        <Text flex="1" textStyle="label" truncate data-testid="call-status">
          {statusText}
        </Text>
        {live && (
          <>
            <Tip label={micOn ? "Mute" : "Unmute"} placement="top">
              <CallControl
                aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
                tone={micOn ? undefined : "danger"}
                onClick={() => controls?.toggleMic()}
              >
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </CallControl>
            </Tip>
            <Tip label={cameraOn ? "Turn camera off" : "Turn camera on"} placement="top">
              <CallControl
                aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
                tone={cameraOn ? undefined : "danger"}
                onClick={() => controls?.toggleCamera()}
              >
                {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
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
            {!fullscreen && (
              <Tip label={expanded ? "Shrink" : "Expand"} placement="top">
                <CallControl
                  aria-label="Expand"
                  aria-pressed={expanded}
                  tone={expanded ? "active" : undefined}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <Shrink size={16} /> : <Expand size={16} />}
                </CallControl>
              </Tip>
            )}
            {document.fullscreenEnabled && (
              <Tip label={fullscreen ? "Exit fullscreen" : "Fullscreen"} placement="top">
                <CallControl
                  aria-label="Fullscreen"
                  aria-pressed={fullscreen}
                  tone={fullscreen ? "active" : undefined}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
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
