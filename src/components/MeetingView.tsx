import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  ShieldCheck,
  Users,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Signal,
  X,
  Send,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import { User, PeerSession } from '../types';
import { generateSASVerification, getCurrentKeyFingerprint } from '../lib/crypto';
import { hasPermission } from '../lib/permissions';
import {
  RTC_CONFIG,
  registerPeerPresence,
  listenToRoomPeers,
  sendP2PSignal,
  listenToP2PSignals,
  RoomPeerInfo,
  P2PSignalMessage,
} from '../lib/p2pSignaling';

interface MeetingViewProps {
  currentUser: User;
  initialRoomId?: string;
  onLeaveMeeting: () => void;
  onOpenSecurityAudit: () => void;
}

export const MeetingView: React.FC<MeetingViewProps> = ({
  currentUser,
  initialRoomId = 'WASE-SECURE-ROOM',
  onLeaveMeeting,
  onOpenSecurityAudit,
}) => {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [inCall, setInCall] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [inMeetingMessages, setInMeetingMessages] = useState<
    Array<{ id: string; sender: string; text: string; time: string }>
  >([]);
  const [sasVerified, setSasVerified] = useState(false);
  const [useVirtualCamera, setUseVirtualCamera] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'reconnecting'>('excellent');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Unique Peer ID for this specific session
  const myPeerIdRef = useRef<string>(`peer_${currentUser.id}_${Math.random().toString(36).substring(2, 9)}`);
  const joinTimeRef = useRef<number>(Date.now());

  // WebRTC Peer States
  const [peers, setPeers] = useState<Map<string, PeerSession>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // SAS Verification computation
  const sas = generateSASVerification(roomId, getCurrentKeyFingerprint());

  // Virtual Camera generator (for iPad Safari sandboxes or systems without webcam access)
  const setupVirtualMediaStream = useCallback((): MediaStream => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    let frame = 0;
    let animId: number;

    const draw = () => {
      frame++;
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);

      // P2P Grid pattern
      ctx.strokeStyle = '#312e81';
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 360);
        ctx.stroke();
      }

      // Animated pulsating center avatar
      const radius = 45 + Math.sin(frame * 0.05) * 4;
      ctx.beginPath();
      ctx.arc(320, 150, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#4f46e5';
      ctx.fill();
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Avatar Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase() || 'ME', 320, 160);

      // User Label & E2EE badge
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(currentUser.name, 320, 220);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText('🔒 WebRTC P2P (AES-256 E2EE)', 320, 245);

      // Soundwave animation
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const h = Math.sin(frame * 0.1 + i) * 15;
        ctx.moveTo(220 + i * 10, 290 - h);
        ctx.lineTo(220 + i * 10, 290 + h);
      }
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);

    // Add quiet oscillator audio track to guarantee negotiation
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(dst);
        osc.start();

        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      }
    } catch (e) {
      console.warn('AudioContext synth notice:', e);
    }

    return canvasStream;
  }, [currentUser]);

  // Flush queued ICE candidates
  const flushIceCandidates = async (peerKey: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueues.current.get(peerKey) || [];
    if (queue.length > 0) {
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC ICE] Candidate flush notice:', e);
        }
      }
      iceCandidateQueues.current.set(peerKey, []);
    }
  };

  // Create WebRTC Peer Connection
  const createPeerConnection = useCallback((
    targetPeerId: string,
    targetUserId: string,
    targetUserName: string,
    targetAvatar?: string
  ): RTCPeerConnection => {
    if (peerConnections.current.has(targetPeerId)) {
      try {
        peerConnections.current.get(targetPeerId)?.close();
      } catch (e) {
        console.warn('Closing prior peer connection:', e);
      }
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(targetPeerId, pc);

    // Attach local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Remote Track Listener
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetPeerId) || {
          peerId: targetPeerId,
          userId: targetUserId,
          userName: targetUserName,
          avatar: targetAvatar,
        };
        next.set(targetPeerId, {
          ...existing,
          stream: remoteStream,
          connectionState: pc.iceConnectionState,
        });
        return next;
      });
    };

    // ICE Candidate generation & signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendP2PSignal({
          id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomId,
          type: 'candidate',
          senderPeerId: myPeerIdRef.current,
          targetPeerId,
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    // ICE Connection State Listener
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      setPeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(targetPeerId);
        if (peer) {
          next.set(targetPeerId, { ...peer, connectionState: state });
        }
        return next;
      });

      if (state === 'connected' || state === 'completed') {
        setNetworkQuality('excellent');
      } else if (state === 'failed' || state === 'disconnected') {
        setNetworkQuality('reconnecting');
        if (state === 'failed') {
          try {
            pc.restartIce();
          } catch (e) {
            console.warn('ICE restart notice:', e);
          }
        }
      }
    };

    return pc;
  }, [roomId]);

  // Start Meeting / Join Room
  const startMeeting = async () => {
    try {
      joinTimeRef.current = Date.now();
      let stream: MediaStream;

      if (useVirtualCamera) {
        stream = setupVirtualMediaStream();
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
            audio: true,
          });
        } catch (mediaErr) {
          console.warn('Physical camera unavailable, auto-switching to virtual avatar:', mediaErr);
          setUseVirtualCamera(true);
          stream = setupVirtualMediaStream();
        }
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setInCall(true);

      // Add system log
      setInMeetingMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'システム (P2P)',
          text: `暗号化会議室 [${roomId}] に入室しました。相手の接続を待機中または確立中です。`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Failed to start meeting:', err);
    }
  };

  // End Meeting / Leave
  const leaveMeeting = () => {
    // Broadcast leave signal
    sendP2PSignal({
      id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type: 'leave',
      senderPeerId: myPeerIdRef.current,
    });

    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all WebRTC peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    iceCandidateQueues.current.clear();
    setPeers(new Map());

    setInCall(false);
    onLeaveMeeting();
  };

  // Core WebRTC Signaling & Room Peer Management
  useEffect(() => {
    if (!inCall) return;

    // 1. Register presence in room
    const unregisterPresence = registerPeerPresence(roomId, {
      peerId: myPeerIdRef.current,
      userId: currentUser.id,
      userName: currentUser.name,
      avatar: currentUser.avatar,
    });

    // 2. Listen to active peers in the room (Polite Peer Pattern)
    const unsubRoomPeers = listenToRoomPeers(roomId, myPeerIdRef.current, async (activePeers: RoomPeerInfo[]) => {
      for (const remotePeer of activePeers) {
        const targetPeerId = remotePeer.peerId;

        // If not connected yet and I am the deterministic offerer (myPeerId < remotePeerId)
        const isOfferer = myPeerIdRef.current < targetPeerId;
        const existingPc = peerConnections.current.get(targetPeerId);

        if (!existingPc && isOfferer) {
          const pc = createPeerConnection(targetPeerId, remotePeer.userId, remotePeer.userName, remotePeer.avatar);
          try {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);

            await sendP2PSignal({
              id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              roomId,
              type: 'offer',
              senderPeerId: myPeerIdRef.current,
              targetPeerId,
              payload: {
                offer: { type: offer.type, sdp: offer.sdp },
                fromUserId: currentUser.id,
                fromUserName: currentUser.name,
                fromAvatar: currentUser.avatar,
              },
            });
          } catch (e) {
            console.error('[WebRTC] Error initiating offer to peer:', remotePeer, e);
          }
        }
      }
    });

    // 3. Listen to incoming P2P signals (BroadcastChannel + Firestore)
    const unsubSignals = listenToP2PSignals(
      roomId,
      myPeerIdRef.current,
      joinTimeRef.current,
      async (signal: P2PSignalMessage) => {
        const fromPeerId = signal.senderPeerId;

        if (signal.type === 'offer' && signal.payload?.offer) {
          const pc = createPeerConnection(
            fromPeerId,
            signal.payload.fromUserId || fromPeerId,
            signal.payload.fromUserName || 'リモート参加者',
            signal.payload.fromAvatar
          );

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.offer));
            await flushIceCandidates(fromPeerId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendP2PSignal({
              id: `ans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              roomId,
              type: 'answer',
              senderPeerId: myPeerIdRef.current,
              targetPeerId: fromPeerId,
              payload: {
                answer: { type: answer.type, sdp: answer.sdp },
                fromUserId: currentUser.id,
              },
            });
          } catch (e) {
            console.error('[WebRTC] Error handling incoming offer:', e);
          }
        } else if (signal.type === 'answer' && signal.payload?.answer) {
          const pc = peerConnections.current.get(fromPeerId);
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.answer));
              await flushIceCandidates(fromPeerId, pc);
            } catch (e) {
              console.error('[WebRTC] Error handling incoming answer:', e);
            }
          }
        } else if (signal.type === 'candidate' && signal.payload?.candidate) {
          const pc = peerConnections.current.get(fromPeerId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
            } catch (e) {
              console.warn('[WebRTC] Error adding ICE candidate:', e);
            }
          } else {
            const queue = iceCandidateQueues.current.get(fromPeerId) || [];
            queue.push(signal.payload.candidate);
            iceCandidateQueues.current.set(fromPeerId, queue);
          }
        } else if (signal.type === 'leave') {
          const pc = peerConnections.current.get(fromPeerId);
          if (pc) {
            pc.close();
            peerConnections.current.delete(fromPeerId);
          }
          iceCandidateQueues.current.delete(fromPeerId);
          setPeers((prev) => {
            const next = new Map(prev);
            next.delete(fromPeerId);
            return next;
          });
        }
      }
    );

    return () => {
      unregisterPresence();
      unsubRoomPeers();
      unsubSignals();
    };
  }, [inCall, roomId, currentUser, createPeerConnection]);

  // Audio mute toggle
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Video mute toggle
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Screen share toggle
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenVideoTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share notice:', err);
      }
    } else {
      if (localStreamRef.current && localVideoRef.current) {
        const originalVideo = localStreamRef.current.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && originalVideo) sender.replaceTrack(originalVideo);
        });
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendMeetingChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setInMeetingMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: currentUser.name,
        text: chatInput.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none touch-manipulation">
      <canvas ref={canvasRef} className="hidden" />

      {/* Meeting Header - iPad Friendly bar */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span className="hidden sm:inline">P2P 暗号化ミーティング</span>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                {roomId}
              </span>
            </h1>
          </div>

          {/* Copy Room ID Button */}
          <button
            onClick={copyRoomCode}
            className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer min-h-[36px]"
            title="ルームIDをコピー"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-medium">{isCopied ? 'コピー済' : 'IDコピー'}</span>
          </button>
        </div>

        {/* Cryptographic SAS MITM Verification & Diagnostics */}
        <div className="flex items-center space-x-2">
          <div
            onClick={onOpenSecurityAudit}
            className="hidden sm:flex items-center space-x-2 bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-lg cursor-pointer hover:border-emerald-500 transition"
            title="中間者攻撃(MITM)防止用の暗号化認証コード"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <div className="flex space-x-1 text-xs">
              {sas.emojis.slice(0, 3).map((emoji, idx) => (
                <span key={idx}>{emoji}</span>
              ))}
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">{sas.code}</span>
          </div>

          {/* Network Quality Badge */}
          <div
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition"
            title="P2P通信ステータスと診断"
          >
            <Signal className={`w-3.5 h-3.5 ${networkQuality === 'excellent' ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-[11px] font-mono text-slate-300 hidden md:inline">
              {peers.size > 0 ? `${peers.size}接続` : 'P2P待機'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Video Grid & Sidebar Container */}
      <div className="flex-1 flex overflow-hidden p-2 md:p-3 gap-2 md:gap-3 relative">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800/80 rounded-2xl relative overflow-hidden shadow-inner">
          {!inCall ? (
            /* Lobby Screen before joining - Optimized for iPad touch */
            <div className="max-w-md w-full mx-4 bg-slate-900/95 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl text-center space-y-5 backdrop-blur-md">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/20">
                <Video className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">P2P 暗号化会議への入室</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  WebRTC直接通信 (P2P) によりサーバーを経由せず端末間で映像・音声を直接伝送します。
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-300">ミーティング ルームID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="例: WASE-SECURE-ROOM"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Virtual Camera Toggle */}
              <div className="flex items-center justify-between text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2 text-left">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="text-slate-200 font-medium">暗号化アバター仮想カメラを使用</div>
                    <div className="text-[10px] text-slate-500">カメラ権限なしでも安全に映像参加可能</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useVirtualCamera}
                  onChange={(e) => setUseVirtualCamera(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <button
                id="btn-join-meeting"
                onClick={startMeeting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-xl shadow-indigo-600/30 transition flex items-center justify-center space-x-2 cursor-pointer min-h-[48px]"
              >
                <Video className="w-5 h-5" />
                <span>通話を開始・参加する</span>
              </button>
            </div>
          ) : (
            /* Active Call Grid - Responsive iPad & Mobile Layout */
            <div className="w-full h-full flex flex-col p-2">
              <div
                className={`flex-1 grid gap-2 md:gap-3 overflow-auto ${
                  peers.size === 0
                    ? 'grid-cols-1 md:grid-cols-2'
                    : peers.size === 1
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {/* Local Video Stream Card */}
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-indigo-600/40 shadow-xl flex items-center justify-center min-h-[180px] md:min-h-[220px]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    muted
                    className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : ''}`}
                  />
                  {isVideoMuted && (
                    <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <div className="w-16 h-16 rounded-full bg-indigo-900/60 border border-indigo-700 flex items-center justify-center text-xl font-bold text-white">
                        {currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-300 font-medium">{currentUser.name} (カメラオフ)</span>
                    </div>
                  )}

                  {/* Local Stream Overlay Tag */}
                  <div className="absolute bottom-2.5 left-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-medium flex items-center space-x-2 text-slate-200">
                    <span>{currentUser.name} (あなた)</span>
                    {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="text-[10px] text-emerald-400 font-mono">● ホスト</span>
                  </div>
                </div>

                {/* Remote Peers Video Streams */}
                {Array.from(peers.values()).map((peer) => (
                  <RemotePeerVideo key={peer.peerId || peer.userId} peer={peer} />
                ))}

                {/* Empty State / Standby Guidance card */}
                {peers.size === 0 && (
                  <div className="bg-slate-950/70 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[180px] md:min-h-[220px]">
                    <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 animate-pulse">
                      <Users className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">相手の接続を待機中...</h4>
                      <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
                        別タブや別のiPad・端末で同じルームID「
                        <span className="font-mono text-indigo-400 font-bold">{roomId}</span>
                        」に参加すると、自動でP2P通信が確立されます。
                      </p>
                    </div>
                    <button
                      onClick={copyRoomCode}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isCopied ? 'ルームIDコピー完了！' : 'ルームIDをコピー'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Floating Control Bar (iPad & Touch friendly 48px hit areas) */}
          {inCall && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-lg border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center space-x-2.5 md:space-x-4 z-30">
              {/* Mic toggle */}
              <button
                id="btn-meeting-toggle-mic"
                onClick={toggleAudio}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                  isAudioMuted
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-600/40 hover:bg-rose-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title={isAudioMuted ? 'マイクをオン' : 'マイクをミュート'}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Video toggle */}
              <button
                id="btn-meeting-toggle-video"
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                  isVideoMuted
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-600/40 hover:bg-rose-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title={isVideoMuted ? 'カメラをオン' : 'カメラをオフ'}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {/* Screen Share toggle */}
              <button
                id="btn-meeting-toggle-screen"
                disabled={!hasPermission(currentUser.role, 'canShareScreen')}
                onClick={toggleScreenShare}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                  !hasPermission(currentUser.role, 'canShareScreen')
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : isScreenSharing
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="画面共有"
              >
                <Monitor className="w-5 h-5" />
              </button>

              {/* In-Call Chat Drawer Toggle */}
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                  isChatOpen
                    ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="通話内チャット"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {/* End Call / Leave Button */}
              <button
                id="btn-meeting-leave"
                onClick={leaveMeeting}
                className="h-12 px-5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center space-x-2 cursor-pointer ml-1"
                title="会議を退出"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline">退出</span>
              </button>
            </div>
          )}
        </div>

        {/* Slide-out In-Meeting Chat Drawer (Optimized for iPad & Mobile) */}
        {inCall && isChatOpen && (
          <aside className="w-80 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shrink-0 overflow-hidden shadow-2xl z-20">
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white">ミーティング チャット</h3>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {inMeetingMessages.map((msg) => (
                <div key={msg.id} className="text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">{msg.sender}</span>
                    <span>{msg.time}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-slate-200 break-words leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMeetingChat} className="p-2.5 border-t border-slate-800 flex gap-2 bg-slate-950/50">
              <input
                type="text"
                placeholder="参加者に送信..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Signal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">WebRTC P2P 通信診断</h3>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono">
                <div className="text-slate-400">自端末 Peer ID:</div>
                <div className="text-indigo-400 text-[11px] break-all">{myPeerIdRef.current}</div>
                <div className="text-slate-400 mt-2">接続先ルーム:</div>
                <div className="text-emerald-400 text-[11px]">{roomId}</div>
                <div className="text-slate-400 mt-2">アクティブ P2P ピア数:</div>
                <div className="text-white text-[11px]">{peers.size} 端末</div>
              </div>

              <div className="text-slate-400 text-[11px] leading-relaxed">
                ※ iPad Safari や Chrome、別ブラウザで同じルームIDに入室すると、Google STUN 経由で P2P メッシュ直接接続されます。
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: Remote Peer Video Box
const RemotePeerVideo: React.FC<{ peer: PeerSession }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch((err) => {
        console.warn('[WebRTC Video] Autoplay delayed:', err);
      });
    }
  }, [peer.stream]);

  const handleManualAudioUnlock = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => {
        setIsAudioUnlocked(true);
      }).catch(() => {});
    }
  };

  const isConnected = peer.connectionState === 'connected' || peer.connectionState === 'completed';

  return (
    <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center min-h-[180px] md:min-h-[220px]">
      {peer.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-indigo-950/80 border border-indigo-700 flex items-center justify-center text-xl font-bold text-white animate-pulse">
            {peer.avatar || peer.userName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs text-slate-300 font-medium">{peer.userName}</span>
          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
            {peer.connectionState === 'checking' ? 'P2Pハンドシェイク中...' : 'P2P直接接続確立中...'}
          </span>
        </div>
      )}

      {/* iPad Audio Tap Prompt if iOS policy blocks sound */}
      {peer.stream && !isAudioUnlocked && (
        <button
          onClick={handleManualAudioUnlock}
          className="absolute top-2.5 right-2.5 bg-indigo-600/90 hover:bg-indigo-500 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-lg transition cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>音声を有効化</span>
        </button>
      )}

      {/* Peer Label & State Pill */}
      <div className="absolute bottom-2.5 left-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-medium flex items-center space-x-2 text-slate-200">
        <span>{peer.userName}</span>
        <span
          className={`text-[10px] font-mono flex items-center gap-1 ${
            isConnected ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
          {isConnected ? 'P2P直結 (暗号化)' : 'P2P接続中'}
        </span>
      </div>
    </div>
  );
};
