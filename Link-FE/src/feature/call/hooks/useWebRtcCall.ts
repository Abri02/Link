import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { WS_URL } from "@/util/constants";
import type { CallEndReason, CallSignal, CallSignalType, MediaState } from "../api/call.types";
import { idleCall, useCallStore } from "../stores/callStore";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
/** The caller gives up (and hangs up) if the callee hasn't answered within this time. */
export const RING_TIMEOUT_MS = 30_000;
/** The callee stops ringing on its own a bit later, in case the caller's HANGUP never arrives. */
const RINGING_FALLBACK_MS = RING_TIMEOUT_MS + 5_000;
/** How long the `ended` state is shown before going back to `idle`. */
const ENDED_RESET_MS = 3_000;

/** One call in progress, from INVITE until it ends. */
interface Session {
  callId: string;
  channelId: number;
  peerUserId: number;
  role: "caller" | "callee";
  /** Callee: accept() was called. Caller: ACCEPT was received. */
  accepted: boolean;
  /** Our open devices, shown in the preview. Stays the same object for the whole call. */
  local: MediaStream;
  /** The peer's tracks. Also one object per call: a track-only `ontrack` has no stream of its own. */
  remote: MediaStream;
  mic: MediaStreamTrack | null;
  camera: MediaStreamTrack | null;
  /** A device request is waiting for the browser; further clicks are ignored until it settles. */
  micPending: boolean;
  cameraPending: boolean;
  /** Screen capture sent in place of the camera track while sharing. */
  screen: MediaStream | null;
  pc: RTCPeerConnection | null;
  /** Fixed slots: turning a device on or off is only a replaceTrack, never a renegotiation. */
  audio: RTCRtpTransceiver | null;
  video: RTCRtpTransceiver | null;
  /** Remote ICE candidates that arrived before the remote description was set. */
  pendingIce: RTCIceCandidateInit[];
  remoteSet: boolean;
  /** Last MEDIA_STATE number we sent, and the highest one we received from the peer. */
  mediaSeq: number;
  peerMediaSeq: number;
  timer?: ReturnType<typeof setTimeout>;
}

const newSession = (callId: string, channelId: number, peerUserId: number, role: Session["role"]): Session => ({
  callId, channelId, peerUserId, role, accepted: false,
  local: new MediaStream(), remote: new MediaStream(), mic: null, camera: null, micPending: false, cameraPending: false,
  screen: null, pc: null, audio: null, video: null, pendingIce: [], remoteSet: false,
  mediaSeq: 0, peerMediaSeq: 0,
});

type DeviceKind = "audio" | "video";

/** The text shown in the call window for a device that failed. */
const deviceMessage = (kind: DeviceKind, errorName: string) => {
  const device = kind === "audio" ? "microphone" : "camera";
  switch (errorName) {
    case "NotAllowedError":
      return "Access is blocked. Allow it in your browser's site settings.";
    case "NotFoundError":
      return `No ${device} found.`;
    case "NotReadableError":
      return `Your ${device} is being used by another app.`;
    default:
      return `Couldn't open your ${device}.`;
  }
};

/** Opens one device. On failure `track` is null and `error` says why: a device never ends a call. */
const openTrack = async (kind: DeviceKind): Promise<{ track: MediaStreamTrack | null; error: string | null }> => {
  // Browsers only expose mediaDevices on HTTPS and localhost.
  if (!navigator.mediaDevices) return { track: null, error: "Calls need HTTPS or localhost for camera and microphone." };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
    return { track: stream.getTracks()[0] ?? null, error: null };
  } catch (e) {
    return { track: null, error: deviceMessage(kind, (e as DOMException).name) };
  }
};
/** `crypto.randomUUID` is also missing without HTTPS, and that must not stop a call from starting. */
const newCallId = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());
const replaceTrack = (slot: RTCRtpTransceiver | null, track: MediaStreamTrack | null) =>
  slot?.sender.replaceTrack(track).catch(() => {});

/**
 * 1-on-1 WebRTC calls (P2P, Google STUN), signaled over STOMP: SEND `/app/call.signal`, receive
 * on `/user/queue/call`. Mount once per logged-in page (`WorkspacePage`). State and controls live
 * in `useCallStore`.
 *
 * State machine: `idle → calling` (we rang) or `idle → ringing` (we are rung), then
 * `→ connected` when the callee accepts, and `→ ended` on hangup, reject, no answer (30 s),
 * a connection failure, or the tab closing. `ended` resets to `idle` after 3 s.
 *
 * Caller: INVITE → (ACCEPT) → OFFER → (ANSWER). Callee: (INVITE) → ACCEPT → (OFFER) → ANSWER.
 * Both sides trickle ICE. The server doesn't guarantee order, so ICE is buffered until the remote
 * description is set. Every exit path goes through `end()`, which stops the tracks and closes the
 * peer connection.
 *
 * Devices never hold up or end a call. The mic is requested when we join and attached when it
 * arrives; the camera only opens from its button. Each call has one audio and one video
 * transceiver from the start (the caller adds them, the callee takes them from the offer), so a
 * device or a screen share is switched with `replaceTrack`.
 */
export function useWebRtcCall(userId: number | null) {
  useEffect(() => {
    if (userId == null) return;
    const set = useCallStore.setState;
    let session: Session | null = null;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/user/queue/call", (frame) => onSignal(JSON.parse(frame.body)));
      },
    });

    const publish = (signal: CallSignal) => {
      if (client.connected) client.publish({ destination: "/app/call.signal", body: JSON.stringify(signal) });
    };
    const send = (s: Session, type: CallSignalType, payload?: CallSignal["payload"]) =>
      publish({ type, callId: s.callId, toUserId: s.peerUserId, channelId: s.channelId, payload });

    /** Ends the current call (optionally telling the peer) and releases every resource. */
    const end = (reason: CallEndReason, notify?: CallSignalType) => {
      const s = session;
      if (!s) return;
      session = null;
      if (notify) send(s, notify);
      clearTimeout(s.timer);
      if (s.pc) {
        s.pc.onicecandidate = s.pc.ontrack = s.pc.onconnectionstatechange = null;
        s.pc.close();
      }
      stopTracks(s.local);
      stopTracks(s.screen);
      set({ ...idleCall, status: "ended", callId: s.callId, channelId: s.channelId, peerUserId: s.peerUserId, endReason: reason });
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (useCallStore.getState().status === "ended") set(idleCall);
      }, ENDED_RESET_MS);
    };

    /** Hang up from our side. Before accepting, the callee's hangup is a reject. */
    const hangUp = () => {
      const s = session;
      if (!s) return;
      if (s.role === "callee" && !s.accepted) end("declined", "REJECT");
      else end("hangup", "HANGUP");
    };

    const createPeer = (s: Session) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate && session === s) send(s, "ICE", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        if (session !== s) return;
        s.remote.addTrack(e.track);
        set({ remoteStream: s.remote });
      };
      pc.onconnectionstatechange = () => {
        if (session === s && pc.connectionState === "failed") end("failed", "HANGUP");
      };
      s.pc = pc;
      return pc;
    };

    const videoTrack = (s: Session) => s.screen?.getVideoTracks()[0] ?? s.camera;

    /** Tells the peer what we have on. Nothing to tell until both sides are in the call. */
    const sendMediaState = (s: Session) => {
      if (!s.accepted) return;
      const state: MediaState = { mic: s.mic?.enabled ?? false, camera: videoTrack(s) != null, seq: ++s.mediaSeq };
      send(s, "MEDIA_STATE", state);
    };

    /** Puts the current devices into the slots, once those exist. */
    const attachTracks = (s: Session) => {
      replaceTrack(s.audio, s.mic);
      replaceTrack(s.video, videoTrack(s));
    };

    const openMic = async (s: Session) => {
      if (s.micPending) return;
      s.micPending = true;
      const { track, error } = await openTrack("audio");
      s.micPending = false;
      if (session !== s) return track?.stop(); // the call ended while waiting for the mic
      if (!track) return set({ deviceError: error });
      track.onended = () => {
        if (session === s && s.mic === track) closeMic(s);
      };
      s.mic = track;
      s.local.addTrack(track);
      replaceTrack(s.audio, track);
      set({ micOn: true, deviceError: null });
      sendMediaState(s);
    };

    /** The mic went away on its own, for example it was unplugged. */
    const closeMic = (s: Session) => {
      s.local.removeTrack(s.mic!);
      s.mic = null;
      replaceTrack(s.audio, null);
      set({ micOn: false, deviceError: deviceMessage("audio", "NotFoundError") });
      sendMediaState(s);
    };

    /** Stopping the track releases the device (its light goes out). A shared screen keeps its slot. */
    const closeCamera = (s: Session, deviceError: string | null) => {
      s.camera!.stop();
      s.local.removeTrack(s.camera!);
      s.camera = null;
      replaceTrack(s.video, videoTrack(s));
      set({ cameraOn: false, deviceError });
      sendMediaState(s);
    };

    /** Muting keeps the track, so unmuting is instant. With no track yet, it asks for the mic again. */
    const toggleMic = () => {
      const s = session;
      if (!s) return;
      if (!s.mic) {
        void openMic(s);
        return;
      }
      s.mic.enabled = !s.mic.enabled;
      set({ micOn: s.mic.enabled, deviceError: null });
      sendMediaState(s);
    };

    const toggleCamera = async () => {
      const s = session;
      if (!s || s.cameraPending) return;
      if (s.camera) return closeCamera(s, null);
      s.cameraPending = true;
      const { track, error } = await openTrack("video");
      s.cameraPending = false;
      if (session !== s) return track?.stop(); // the call ended while waiting for the camera
      if (!track) return set({ deviceError: error });
      track.onended = () => {
        if (session === s && s.camera === track) closeCamera(s, deviceMessage("video", "NotFoundError"));
      };
      s.camera = track;
      s.local.addTrack(track);
      set({ cameraOn: true, deviceError: null });
      replaceTrack(s.video, videoTrack(s));
      sendMediaState(s);
    };

    const applyRemote = async (s: Session, desc: RTCSessionDescriptionInit) => {
      await s.pc!.setRemoteDescription(desc);
      s.remoteSet = true;
      const buffered = s.pendingIce.splice(0);
      for (const c of buffered) await s.pc!.addIceCandidate(c).catch(() => {});
    };

    /** Runs an async signaling step; any error ends the call as failed. */
    const step = (s: Session, fn: () => Promise<void>) =>
      fn().catch(() => {
        if (session === s) end("failed", "HANGUP");
      });

    const onSignal = (sig: CallSignal) => {
      if (sig.fromUserId == null) return;

      if (sig.type === "INVITE") {
        if (session) {
          // Busy. (A repeated INVITE for our own call is ignored.)
          if (sig.callId !== session.callId) {
            publish({ type: "REJECT", callId: sig.callId, toUserId: sig.fromUserId, channelId: sig.channelId });
          }
          return;
        }
        const s = newSession(sig.callId, sig.channelId, sig.fromUserId, "callee");
        session = s;
        s.timer = setTimeout(() => end("no-answer"), RINGING_FALLBACK_MS);
        set({ ...idleCall, status: "ringing", callId: s.callId, channelId: s.channelId, peerUserId: s.peerUserId });
        return;
      }

      const s = session;
      if (!s || sig.callId !== s.callId || sig.fromUserId !== s.peerUserId) return;

      switch (sig.type) {
        case "ACCEPT": {
          if (s.role !== "caller" || s.accepted) return;
          s.accepted = true;
          clearTimeout(s.timer);
          set({ status: "connected" });
          sendMediaState(s);
          const pc = createPeer(s);
          s.audio = pc.addTransceiver("audio", { direction: "sendrecv" });
          s.video = pc.addTransceiver("video", { direction: "sendrecv" });
          attachTracks(s);
          step(s, async () => {
            await pc.setLocalDescription(await pc.createOffer());
            if (session === s) send(s, "OFFER", pc.localDescription!.toJSON());
          });
          return;
        }
        case "OFFER": {
          const pc = s.pc;
          if (s.role !== "callee" || !pc || s.remoteSet || !sig.payload) return;
          step(s, async () => {
            await applyRemote(s, sig.payload as RTCSessionDescriptionInit);
            // Taken from the offer: transceivers added earlier wouldn't match its m-lines.
            for (const t of pc.getTransceivers()) {
              t.direction = "sendrecv";
              if (t.receiver.track.kind === "audio") s.audio = t;
              else s.video = t;
            }
            attachTracks(s);
            await pc.setLocalDescription(await pc.createAnswer());
            if (session === s) send(s, "ANSWER", pc.localDescription!.toJSON());
          });
          return;
        }
        case "ANSWER": {
          if (s.role !== "caller" || !s.pc || s.remoteSet || !sig.payload) return;
          step(s, () => applyRemote(s, sig.payload as RTCSessionDescriptionInit));
          return;
        }
        case "ICE": {
          const candidate = sig.payload as RTCIceCandidateInit | undefined;
          if (!candidate) return;
          if (s.pc && s.remoteSet) s.pc.addIceCandidate(candidate).catch(() => {});
          else s.pendingIce.push(candidate);
          return;
        }
        case "MEDIA_STATE": {
          const state = sig.payload as MediaState | undefined;
          if (!state || !(state.seq > s.peerMediaSeq)) return; // an older change arriving late
          s.peerMediaSeq = state.seq;
          set({ peerMicOn: state.mic === true, peerCameraOn: state.camera === true });
          return;
        }
        case "REJECT":
          end(s.role === "caller" ? "rejected" : "remote-hangup");
          return;
        case "HANGUP":
          end("remote-hangup");
          return;
        case "PREMIUM_REQUIRED":
          end("premium-required");
          return;
      }
    };

    const startCall = (channelId: number, peerUserId: number) => {
      if (session || !client.connected) return;
      const s = newSession(newCallId(), channelId, peerUserId, "caller");
      session = s;
      clearTimeout(resetTimer);
      set({ ...idleCall, status: "calling", callId: s.callId, channelId, peerUserId, localStream: s.local });
      send(s, "INVITE");
      s.timer = setTimeout(() => {
        if (session === s) end("no-answer", "HANGUP");
      }, RING_TIMEOUT_MS);
      void openMic(s);
    };

    const accept = () => {
      const s = session;
      if (!s || s.role !== "callee" || s.accepted) return;
      s.accepted = true;
      clearTimeout(s.timer);
      createPeer(s);
      set({ status: "connected", localStream: s.local });
      send(s, "ACCEPT");
      sendMediaState(s);
      void openMic(s);
    };

    const reject = () => {
      if (session?.role === "callee" && !session.accepted) end("declined", "REJECT");
    };

    const stopScreenShare = (s: Session) => {
      const screen = s.screen;
      if (!screen) return;
      s.screen = null;
      stopTracks(screen);
      set({ screenStream: null });
      replaceTrack(s.video, videoTrack(s));
      sendMediaState(s);
    };

    const toggleScreenShare = async () => {
      const s = session;
      if (!s || !s.pc || !s.accepted) return;
      if (s.screen) return stopScreenShare(s);
      let screen: MediaStream;
      try {
        screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        return; // picker cancelled or not allowed: nothing changes
      }
      const track = screen.getVideoTracks()[0];
      // The call ended, or another share started, while the picker was open.
      if (session !== s || s.screen || !track) return stopTracks(screen);
      s.screen = screen;
      // The browser's own "Stop sharing" button ends the track.
      track.onended = () => {
        if (s.screen === screen) stopScreenShare(s);
      };
      set({ screenStream: screen });
      replaceTrack(s.video, track);
      sendMediaState(s);
    };

    // Closing or reloading the tab hangs up, so the peer isn't left waiting.
    window.addEventListener("pagehide", hangUp);
    set({ controls: { startCall, accept, reject, hangUp, toggleMic, toggleCamera, toggleScreenShare } });
    client.activate();

    return () => {
      window.removeEventListener("pagehide", hangUp);
      hangUp();
      clearTimeout(resetTimer);
      set({ ...idleCall, controls: null });
      client.deactivate();
    };
  }, [userId]);
}
