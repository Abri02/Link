import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { WS_URL } from "@/util/constants";
import type { CallEndReason, CallSignal, CallSignalType } from "../api/call.types";
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
  local: MediaStream | null;
  pc: RTCPeerConnection | null;
  /** Remote ICE candidates that arrived before the remote description was set. */
  pendingIce: RTCIceCandidateInit[];
  remoteSet: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const getMedia = () => navigator.mediaDevices.getUserMedia({ audio: true, video: true });
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

/**
 * 1-on-1 WebRTC calls (P2P, Google STUN), signaled over STOMP: SEND `/app/call.signal`, receive
 * on `/user/queue/call`. Mount once per logged-in page (`WorkspacePage`). State and controls live
 * in `useCallStore`.
 *
 * State machine: `idle → calling` (we rang) or `idle → ringing` (we are rung), then
 * `→ connected` when the callee accepts, and `→ ended` on hangup, reject, no answer (30 s),
 * a media or connection failure, or the tab closing. `ended` resets to `idle` after 3 s.
 *
 * Caller: INVITE → (ACCEPT) → OFFER → (ANSWER). Callee: (INVITE) → ACCEPT → (OFFER) → ANSWER.
 * Both sides trickle ICE. The server doesn't guarantee order, so ICE is buffered until the remote
 * description is set. Every exit path goes through `end()`, which stops the tracks and closes the
 * peer connection.
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
      s.local!.getTracks().forEach((t) => pc.addTrack(t, s.local!));
      pc.onicecandidate = (e) => {
        if (e.candidate && session === s) send(s, "ICE", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        if (session === s) set({ remoteStream: e.streams[0] ?? new MediaStream([e.track]) });
      };
      pc.onconnectionstatechange = () => {
        if (session === s && pc.connectionState === "failed") end("failed", "HANGUP");
      };
      s.pc = pc;
      return pc;
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
        const s: Session = {
          callId: sig.callId, channelId: sig.channelId, peerUserId: sig.fromUserId, role: "callee",
          accepted: false, local: null, pc: null, pendingIce: [], remoteSet: false,
        };
        session = s;
        s.timer = setTimeout(() => end("no-answer"), RINGING_FALLBACK_MS);
        set({ ...idleCall, status: "ringing", callId: s.callId, channelId: s.channelId, peerUserId: s.peerUserId });
        return;
      }

      const s = session;
      if (!s || sig.callId !== s.callId || sig.fromUserId !== s.peerUserId) return;

      switch (sig.type) {
        case "ACCEPT": {
          if (s.role !== "caller" || s.accepted || !s.local) return;
          s.accepted = true;
          clearTimeout(s.timer);
          set({ status: "connected" });
          const pc = createPeer(s);
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
        case "REJECT":
          end(s.role === "caller" ? "rejected" : "remote-hangup");
          return;
        case "HANGUP":
          end("remote-hangup");
          return;
      }
    };

    const startCall = async (channelId: number, peerUserId: number) => {
      if (session || !client.connected) return;
      const s: Session = {
        callId: crypto.randomUUID(), channelId, peerUserId, role: "caller",
        accepted: false, local: null, pc: null, pendingIce: [], remoteSet: false,
      };
      session = s;
      clearTimeout(resetTimer);
      set({ ...idleCall, status: "calling", callId: s.callId, channelId, peerUserId });
      let local: MediaStream;
      try {
        local = await getMedia();
      } catch {
        if (session === s) end("media-error");
        return;
      }
      if (session !== s) return stopTracks(local); // hung up while waiting for the camera
      s.local = local;
      set({ localStream: local });
      send(s, "INVITE");
      s.timer = setTimeout(() => {
        if (session === s) end("no-answer", "HANGUP");
      }, RING_TIMEOUT_MS);
    };

    const accept = async () => {
      const s = session;
      if (!s || s.role !== "callee" || s.accepted) return;
      s.accepted = true;
      clearTimeout(s.timer);
      let local: MediaStream;
      try {
        local = await getMedia();
      } catch {
        if (session === s) end("media-error", "REJECT");
        return;
      }
      if (session !== s) return stopTracks(local); // the caller hung up meanwhile
      s.local = local;
      createPeer(s);
      set({ status: "connected", localStream: local });
      send(s, "ACCEPT");
    };

    const reject = () => {
      if (session?.role === "callee" && !session.accepted) end("declined", "REJECT");
    };

    // Closing or reloading the tab hangs up, so the peer isn't left waiting.
    window.addEventListener("pagehide", hangUp);
    set({ controls: { startCall, accept, reject, hangUp } });
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
