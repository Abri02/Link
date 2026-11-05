import { create } from "zustand";
import type { CallEndReason, CallStatus } from "../api/call.types";

export interface CallControls {
  startCall: (channelId: number, peerUserId: number) => void;
  accept: () => void;
  reject: () => void;
  hangUp: () => void;
  /** Starts sharing the screen instead of the camera, or stops it. Only while connected. */
  toggleScreenShare: () => void;
}

/**
 * State of the current 1-on-1 call. Written only by `useWebRtcCall` (mounted once in
 * `WorkspacePage`); components read it and call `controls`.
 */
interface CallState {
  status: CallStatus;
  callId: string | null;
  channelId: number | null;
  peerUserId: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Our screen capture while we share it (sent in place of the camera). */
  screenStream: MediaStream | null;
  endReason: CallEndReason | null;
  controls: CallControls | null;
}

export const idleCall = {
  status: "idle",
  callId: null,
  channelId: null,
  peerUserId: null,
  localStream: null,
  remoteStream: null,
  screenStream: null,
  endReason: null,
} satisfies Omit<CallState, "controls">;

export const useCallStore = create<CallState>(() => ({ ...idleCall, controls: null }));
