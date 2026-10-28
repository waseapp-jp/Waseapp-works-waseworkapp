/**
 * WaseWorkApp - Production-Grade WebRTC P2P Signaling Engine
 * Features:
 * 1. Hybrid Transport: BroadcastChannel (0ms local/same device/split-view) + Firestore real-time collection
 * 2. Peer Presence Management: Auto-discovery of active peers per room
 * 3. Perfect Negotiation & Deterministic Role Resolution (Polite Peer Pattern)
 * 4. Stale Signal Pruning: Ignores expired past session signals
 */

import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

export interface RoomPeerInfo {
  peerId: string;
  userId: string;
  userName: string;
  avatar?: string;
  joinedAt: number;
  lastPing: number;
}

export interface P2PSignalMessage {
  id: string;
  roomId: string;
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave' | 'ping';
  senderPeerId: string;
  targetPeerId?: string;
  payload?: any;
  timestamp: string;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Register user presence in the room and send periodic heartbeats
 */
export function registerPeerPresence(
  roomId: string,
  peerInfo: { peerId: string; userId: string; userName: string; avatar?: string }
): () => void {
  const roomDocRef = doc(db, 'p2p_rooms', roomId, 'peers', peerInfo.peerId);
  const now = Date.now();

  const data: RoomPeerInfo = {
    ...peerInfo,
    joinedAt: now,
    lastPing: now,
  };

  // Immediate presence write
  setDoc(roomDocRef, data, { merge: true }).catch((err) => {
    console.warn('[P2P Presence] Initial presence registration notice:', err);
  });

  // Heartbeat every 10 seconds
  const pingInterval = setInterval(() => {
    setDoc(roomDocRef, { lastPing: Date.now() }, { merge: true }).catch(() => {});
  }, 10000);

  // Return cleanup function
  return () => {
    clearInterval(pingInterval);
    deleteDoc(roomDocRef).catch(() => {});
  };
}

/**
 * Listen to all active peers currently in the room
 */
export function listenToRoomPeers(
  roomId: string,
  myPeerId: string,
  onPeersChange: (peers: RoomPeerInfo[]) => void
): () => void {
  const peersColRef = collection(db, 'p2p_rooms', roomId, 'peers');

  const unsubscribe = onSnapshot(peersColRef, (snapshot) => {
    const activePeers: RoomPeerInfo[] = [];
    const staleThreshold = Date.now() - 45000; // 45 seconds timeout

    snapshot.docs.forEach((d) => {
      const data = d.data() as RoomPeerInfo;
      // Filter out self and dead peers
      if (data.peerId !== myPeerId && (data.lastPing || 0) >= staleThreshold) {
        activePeers.push(data);
      }
    });

    onPeersChange(activePeers);
  }, (err) => {
    console.warn('[P2P Peers] Snapshot listener notice:', err);
  });

  return unsubscribe;
}

/**
 * Send WebRTC Signal via both BroadcastChannel (local 0ms) and Firestore (cross-device)
 */
export async function sendP2PSignal(signal: Omit<P2PSignalMessage, 'timestamp'>): Promise<void> {
  const fullSignal: P2PSignalMessage = {
    ...signal,
    timestamp: new Date().toISOString(),
  };

  // 1. BroadcastChannel (for same browser / tabs / iPad split-screen testing)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(`wase_p2p_${signal.roomId}`);
      bc.postMessage(fullSignal);
      bc.close();
    }
  } catch (e) {
    // BroadcastChannel unsupported or sandbox error
  }

  // 2. Firestore collection for cross-device signaling
  try {
    const signalRef = doc(db, 'p2p_signals', signal.id);
    await setDoc(signalRef, fullSignal);
  } catch (e) {
    console.warn('[P2P Signaling] Firestore signal dispatch notice:', e);
  }
}

/**
 * Listen for incoming signals for this peer in this room
 */
export function listenToP2PSignals(
  roomId: string,
  myPeerId: string,
  joinTimeMs: number,
  onSignal: (signal: P2PSignalMessage) => void
): () => void {
  const seenSignalIds = new Set<string>();

  // 1. BroadcastChannel listener
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(`wase_p2p_${roomId}`);
      bc.onmessage = (event) => {
        const msg = event.data as P2PSignalMessage;
        if (!msg || !msg.id || seenSignalIds.has(msg.id)) return;
        if (msg.roomId !== roomId || msg.senderPeerId === myPeerId) return;
        if (msg.targetPeerId && msg.targetPeerId !== myPeerId) return;

        seenSignalIds.add(msg.id);
        onSignal(msg);
      };
    }
  } catch (e) {
    console.warn('[P2P Signaling] BroadcastChannel unavailable:', e);
  }

  // 2. Firestore listener (ignoring signals created before this session joined)
  const signalsQuery = query(
    collection(db, 'p2p_signals'),
    where('roomId', '==', roomId)
  );

  const unsubFirestore = onSnapshot(signalsQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const msg = change.doc.data() as P2PSignalMessage;
        if (!msg || !msg.id || seenSignalIds.has(msg.id)) return;
        if (msg.senderPeerId === myPeerId) return;
        if (msg.targetPeerId && msg.targetPeerId !== myPeerId) return;

        // Ensure signal is not from an ancient session
        const signalTime = new Date(msg.timestamp).getTime();
        if (signalTime < joinTimeMs - 10000) return;

        seenSignalIds.add(msg.id);
        onSignal(msg);
      }
    });
  }, (err) => {
    console.warn('[P2P Signals] Firestore listener notice:', err);
  });

  return () => {
    if (bc) {
      bc.close();
    }
    unsubFirestore();
  };
}
