import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Lock,
  Smile,
  CheckSquare,
  Video,
  Hash,
  User as UserIcon,
  ShieldCheck,
  FileText,
  Download,
  Search,
  Plus,
  X,
  MessageSquare,
  Sparkles,
  FolderPlus,
  PanelLeft,
} from 'lucide-react';
import { Channel, Message, User } from '../types';
import { encryptText, encryptBinaryFile, decryptBinaryFile } from '../lib/crypto';
import { socketClient } from '../lib/websocket';
import { hasPermission } from '../lib/permissions';

interface ChatViewProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (id: string) => void;
  messages: Message[];
  currentUser: User;
  onSendMessage: (msg: {
    channelId: string;
    encryptedContent: string;
    iv: string;
    attachmentId?: string;
    attachmentName?: string;
  }) => void;
  onCreateTaskFromMessage: (text: string) => void;
  onStartMeetingInChannel: (channelName: string) => void;
  onUploadEncryptedFile: (file: File) => Promise<{ id: string; name: string }>;
  onCreateChannel?: (channel: { name: string; description: string; category: 'general' | 'dev' | 'project' | 'announcement'; isPrivate: boolean }) => void;
  onStartDM?: (recipientName: string, roleTitle?: string, email?: string) => void;
  onDeleteChannel?: (channelId: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
  messages,
  currentUser,
  onSendMessage,
  onCreateTaskFromMessage,
  onStartMeetingInChannel,
  onUploadEncryptedFile,
  onCreateChannel,
  onStartDM,
  onDeleteChannel,
}) => {
  const [inputText, setInputText] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ id: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // DM Modal State
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
  const [dmRecipientName, setDmRecipientName] = useState('');
  const [dmRecipientRole, setDmRecipientRole] = useState('認定社員');
  const [dmRecipientEmail, setDmRecipientEmail] = useState('');

  // Channel Creation Modal State
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState<'general' | 'dev' | 'project' | 'announcement'>('general');
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teamChannels = channels.filter((c) => c.category !== 'direct');
  const dmChannels = channels.filter((c) => c.category === 'direct');

  const activeChannel = channels.find((c) => c.id === activeChannelId) || (channels.length > 0 ? channels[0] : null);

  const isCurrentDM = activeChannel?.category === 'direct';
  const channelMessages = activeChannel ? messages.filter((m) => m.channelId === activeChannel.id) : [];

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  const handleSend = async () => {
    if (!activeChannel || (!inputText.trim() && !attachedFile) || isEncrypting) return;

    try {
      setIsEncrypting(true);
      const textToEncrypt = inputText.trim() || `[暗号化ファイルを共有しました: ${attachedFile?.name}]`;
      const { cipherText, iv } = await encryptText(textToEncrypt);

      onSendMessage({
        channelId: activeChannel.id,
        encryptedContent: cipherText,
        iv,
        attachmentId: attachedFile?.id,
        attachmentName: attachedFile?.name,
      });

      setInputText('');
      setAttachedFile(null);
    } catch (err) {
      console.error('Failed to encrypt message:', err);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const uploaded = await onUploadEncryptedFile(file);
      setAttachedFile(uploaded);
    } catch (err) {
      console.error('File upload encryption failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateDMSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmRecipientName.trim()) return;

    if (onStartDM) {
      onStartDM(dmRecipientName.trim(), dmRecipientRole.trim(), dmRecipientEmail.trim());
    }
    setIsDMModalOpen(false);
    setDmRecipientName('');
    setDmRecipientRole('認定社員');
    setDmRecipientEmail('');
  };

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    if (onCreateChannel) {
      onCreateChannel({
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || '社内連絡・情報共有チャンネル',
        category: newChannelCategory,
        isPrivate: newChannelIsPrivate,
      });
    }
    setIsChannelModalOpen(false);
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelCategory('general');
    setNewChannelIsPrivate(false);
  };

  const canSend = hasPermission(currentUser.role, 'canSendMessage');
  const canAttach = hasPermission(currentUser.role, 'canAttachFiles');
  const canStartMeeting = hasPermission(currentUser.role, 'canStartInstantMeeting');

  return (
    <div className="flex-1 flex h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 relative">
      {/* Left Channels / Direct Messages List */}
      <aside className={`${isSidebarOpen ? 'w-64 md:w-72 flex' : 'hidden'} bg-slate-900 border-r border-slate-800 flex-col shrink-0 transition-all select-none h-full max-h-full overflow-hidden`}>
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            チャット & チャンネル
          </h2>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> E2EE
          </span>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-slate-800/60 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="チャンネルやDMを絞り込み..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Channel & DM Scroll Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-4">
          {/* Team Channels Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 flex items-center justify-between">
              <span>チームチャンネル</span>
              <button
                id="btn-open-create-channel"
                onClick={() => setIsChannelModalOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 hover:bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-800/80 transition cursor-pointer"
                title="新しいチャンネルを作成"
              >
                <Plus className="w-3 h-3" />
                <span>作成</span>
              </button>
            </div>
            
            <div className="space-y-0.5 mt-1">
              {teamChannels.length === 0 ? (
                <div className="p-3 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 my-1">
                  <p className="text-[11px] text-slate-500 mb-2">チャンネルはまだありません</p>
                  <button
                    onClick={() => setIsChannelModalOpen(true)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/30 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>チャンネルを作成する</span>
                  </button>
                </div>
              ) : (
                teamChannels
                  .filter((c) => c.name.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((ch) => {
                    const isActive = activeChannel && ch.id === activeChannel.id;
                    return (
                      <div
                        key={ch.id}
                        className="group flex items-center justify-between rounded-lg transition"
                      >
                        <button
                          id={`channel-btn-${ch.id}`}
                          onClick={() => onSelectChannel(ch.id)}
                          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600/30 text-indigo-300 font-medium border border-indigo-600/40'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <span className="truncate">{ch.name}</span>
                          </div>
                          {ch.unreadCount && ch.unreadCount > 0 ? (
                            <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                              {ch.unreadCount}
                            </span>
                          ) : null}
                        </button>
                        {onDeleteChannel && (
                          <button
                            onClick={() => onDeleteChannel(ch.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition ml-1 cursor-pointer"
                            title="このチャンネルを削除"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 flex items-center justify-between">
              <span>ダイレクトメッセージ</span>
              <button
                id="btn-open-dm-modal"
                onClick={() => setIsDMModalOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 hover:bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-800/80 transition cursor-pointer"
                title="新しい1対1のダイレクトメッセージを開始"
              >
                <Plus className="w-3 h-3" />
                <span>新規DM</span>
              </button>
            </div>

            {/* DM List */}
            <div className="space-y-0.5 mt-1">
              {dmChannels.length === 0 ? (
                <div className="p-3 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 my-1">
                  <p className="text-[11px] text-slate-500 mb-1.5">ダイレクトメッセージはありません</p>
                  <button
                    onClick={() => setIsDMModalOpen(true)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/30 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>DMを開始する</span>
                  </button>
                </div>
              ) : (
                dmChannels
                  .filter((dm) => dm.name.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((dm) => {
                    const isActive = activeChannel && dm.id === activeChannel.id;
                    const avatar = dm.dmPeer?.avatar || dm.name.slice(0, 2).toUpperCase();
                    const status = dm.dmPeer?.status || 'online';
                    return (
                      <div
                        key={dm.id}
                        id={`dm-item-${dm.id}`}
                        onClick={() => onSelectChannel(dm.id)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isActive
                            ? 'bg-indigo-600/30 text-indigo-300 font-medium border border-indigo-600/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-6 h-6 rounded-full bg-slate-700 text-[10px] flex items-center justify-center text-white font-bold">
                              {avatar}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                                status === 'online'
                                  ? 'bg-emerald-500'
                                  : status === 'in_meeting'
                                  ? 'bg-purple-500'
                                  : 'bg-amber-500'
                              }`}
                            />
                          </div>
                          <div className="truncate">
                            <div className="truncate text-xs">{dm.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {dm.dmPeer?.roleTitle || '社内社員'}
                            </div>
                          </div>
                        </div>

                        {/* Close / Delete DM thread button */}
                        {onDeleteChannel && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChannel(dm.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-700/60 rounded transition cursor-pointer"
                            title="このDMスレッドを閉じる"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Thread */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-14 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 truncate">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 cursor-pointer shrink-0 transition"
                  title={isSidebarOpen ? "チャンネル一覧を折りたたむ" : "チャンネル一覧を展開"}
                >
                  <PanelLeft className="w-4 h-4 text-indigo-400" />
                </button>
                {isCurrentDM ? (
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-900/80 border border-indigo-700/80 flex items-center justify-center text-indigo-200 font-bold text-xs">
                      {activeChannel.dmPeer?.avatar || activeChannel.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400 shrink-0">
                    <Hash className="w-4 h-4" />
                  </div>
                )}
                <div className="truncate">
                  <div className="flex items-center space-x-2">
                    <h1 className="text-sm font-bold text-white truncate">{activeChannel.name}</h1>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono shrink-0">
                      <ShieldCheck className="w-3 h-3" /> {isCurrentDM ? '1対1 E2EE' : 'AES-256 E2EE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isCurrentDM
                      ? `1対1 エンドツーエンド暗号化ダイレクトメッセージ • ${activeChannel.dmPeer?.roleTitle || '社内社員'}`
                      : activeChannel.description}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  id="btn-channel-p2p-meeting"
                  disabled={!canStartMeeting}
                  onClick={() => onStartMeetingInChannel(activeChannel.name)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-medium shadow transition ${
                    canStartMeeting
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                  title={
                    canStartMeeting
                      ? 'このチャンネルの参加者とP2P暗号化会議を開始'
                      : '閲覧者 (Viewer) ロールは会議開始権限がありません'
                  }
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>P2Pミーティング</span>
                </button>
              </div>
            </div>

            {/* Messages List Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
              {channelMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">
                      「{activeChannel.name}」へようこそ
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      すべてのメッセージと添付ファイルはクライアント側で AES-256-GCM により暗号化され、安全に送受信されます。
                    </p>
                  </div>
                </div>
              ) : (
                channelMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start space-x-3 group ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {msg.senderAvatar || msg.senderName.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Bubble & Metadata */}
                      <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 px-1">
                          <span className="font-semibold text-slate-300">{msg.senderName}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center">
                            <Lock className="w-2.5 h-2.5 mr-0.5" /> 復号済
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow relative ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.decryptedContent || msg.encryptedContent}</p>

                          {/* Attachment Pill if any */}
                          {msg.attachmentName && (
                            <div className="mt-2 pt-2 border-t border-indigo-400/30 flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg text-[11px]">
                              <div className="flex items-center space-x-2 truncate">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{msg.attachmentName}</span>
                              </div>
                              <span className="text-[10px] text-emerald-300 font-mono ml-2 shrink-0">🔒 E2EE File</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Action: Convert to Task */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 px-1">
                          <button
                            onClick={() => onCreateTaskFromMessage(msg.decryptedContent || msg.encryptedContent)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded shadow cursor-pointer"
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>タスク化</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box Area */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
              {attachedFile && (
                <div className="mb-2 flex items-center justify-between bg-indigo-950/60 border border-indigo-800/80 px-3 py-1.5 rounded-lg text-xs text-indigo-200">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate">暗号化添付: {attachedFile.name}</span>
                  </div>
                  <button onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:border-indigo-500 transition shadow-inner">
                <textarea
                  rows={2}
                  disabled={!canSend}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => {
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    !canSend
                      ? '閲覧者 (Viewer) ロールはメッセージ送信権限がありません'
                      : `「#${activeChannel.name}」に暗号化メッセージを送信... (Enterで送信, Shift+Enterで改行)`
                  }
                  className="w-full bg-transparent px-3 py-2 text-sm sm:text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none"
                />

                <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={!canAttach || isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer ${
                        !canAttach ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title={!canAttach ? '閲覧者は添付権限がありません' : '暗号化ファイルを添付'}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    id="btn-chat-send-message"
                    type="button"
                    disabled={!canSend || isEncrypting || (!inputText.trim() && !attachedFile)}
                    onClick={handleSend}
                    onTouchEnd={(e) => {
                      if (canSend && !isEncrypting && (inputText.trim() || attachedFile)) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition cursor-pointer active:scale-95 ${
                      !canSend || (!inputText.trim() && !attachedFile)
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isEncrypting ? '暗号化中...' : '送信'}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State when no channel is created or selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
              <Hash className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h2 className="text-base font-bold text-white">チャンネルがありません</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                社内コミュニケーションを開始するには、左サイドバーまたは下のボタンから最初のチャンネルを作成してください。
              </p>
            </div>
            <button
              onClick={() => setIsChannelModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新規チャンネルを作成</span>
            </button>
          </div>
        )}
      </main>

      {/* Channel Creation Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">新規チャンネル作成</h3>
              </div>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  チャンネル名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="例: 一般連絡, 開発チーム, プロジェクトA"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  説明 / 用途 (任意)
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="例: 全社のアナウンスや日常の連絡"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  カテゴリー
                </label>
                <select
                  value={newChannelCategory}
                  onChange={(e) => setNewChannelCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="general">一般 (General)</option>
                  <option value="dev">開発・エンジニアリング (Dev)</option>
                  <option value="project">プロジェクト進行 (Project)</option>
                  <option value="announcement">重要アナウンス (Announcement)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="private-chk"
                  checked={newChannelIsPrivate}
                  onChange={(e) => setNewChannelIsPrivate(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="private-chk" className="text-xs text-slate-300">
                  非公開チャンネルにする (承認されたメンバーのみアクセス可)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow cursor-pointer"
                >
                  チャンネルを作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Message (DM) Modal */}
      {isDMModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">新しいダイレクトメッセージを開始</h3>
              </div>
              <button
                onClick={() => setIsDMModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDMSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  社員名 / 宛先 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dmRecipientName}
                  onChange={(e) => setDmRecipientName(e.target.value)}
                  placeholder="例: 佐藤 結衣"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  所属 / 役職 (任意)
                </label>
                <input
                  type="text"
                  value={dmRecipientRole}
                  onChange={(e) => setDmRecipientRole(e.target.value)}
                  placeholder="例: プロダクトマネージャー"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  社内メールアドレス (任意)
                </label>
                <input
                  type="email"
                  value={dmRecipientEmail}
                  onChange={(e) => setDmRecipientEmail(e.target.value)}
                  placeholder="例: sato@company.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">クイック宛先選択:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: '田中 健一', role: 'セキュリティ統括責任者' },
                    { name: '佐藤 結衣', role: 'プロダクトマネージャー' },
                    { name: '鈴木 蓮', role: 'インフラ・WebRTCエンジニア' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDmRecipientName(preset.name);
                        setDmRecipientRole(preset.role);
                      }}
                      className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                    >
                      {preset.name} ({preset.role.slice(0, 6)})
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDMModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow cursor-pointer"
                >
                  暗号化DMを開始
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
