/** Mirrors the backend `CallSignal` (messaging-service `call/CallSignalController.kt`). */
export type CallSignalType = "INVITE" | "ACCEPT" | "REJECT" | "HANGUP" | "OFFER" | "ANSWER" | "ICE" | "PREMIUM_REQUIRED";

export interface CallSignal {
  type: CallSignalType;
  callId: string;
  toUserId: number;
  channelId: number;
  /** Set by the server from the sender's token; ignored when sending. */
  fromUserId?: number;
  /** SDP for OFFER/ANSWER, an ICE candidate for ICE. */
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

/** `calling`: we rang the peer. `ringing`: the peer is ringing us. */
export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export type CallEndReason =
  | "hangup"         // we hung up
  | "remote-hangup"  // the peer hung up (or closed their tab)
  | "rejected"       // the peer rejected our call (or was busy)
  | "declined"       // we rejected an incoming call
  | "no-answer"      // nobody answered within the timeout
  | "failed"         // the peer connection failed
  | "premium-required"; // the workspace is on the Free plan
