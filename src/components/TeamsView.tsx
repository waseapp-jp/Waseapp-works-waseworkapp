import React, { useState } from 'react';
import { Users, Hash, Plus, Shield, MessageSquare, Video, Lock } from 'lucide-react';
import { Channel, User } from '../types';

interface TeamsViewProps {
  channels: Channel[];
  currentUser: User;
  onSelectChannel: (id: string) => void;
  onStartMeeting: (channelName: string) => void;
  onCreateChannel: (name: string, description: string) => void;
}

export const TeamsView: React.FC<TeamsViewProps> = ({
  channels,
  currentUser,
  onSelectChannel,
  onStartMeeting,
  onCreateChannel,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const teamChannels = channels.filter((ch) => ch.category !== 'direct');
  const teamMembers: User[] = [currentUser];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    onCreateChannel(newChannelName.trim(), newChannelDesc.trim());
    setNewChannelName('');
    setNewChannelDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h1 className="text-base font-bold text-white tracking-tight">チーム & 組織チャンネル</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>新しいチャンネルを作成</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full space-y-6">
        {/* Channels Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>登録チャンネル ({teamChannels.length})</span>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Lock className="w-3 h-3" /> 全チャンネル AES-256 E2EE 対応
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teamChannels.map((ch) => (
              <div
                key={ch.id}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 shadow transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400">
                        <Hash className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-white">{ch.name}</h3>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-2 py-0.5 rounded font-mono">
                      暗号化保護
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {ch.description}
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => onSelectChannel(ch.id)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center space-x-1 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>チャットを開く</span>
                  </button>
                  <button
                    onClick={() => onStartMeeting(ch.name)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>P2Pミーティング</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Members Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            組織メンバー一覧 ({teamMembers.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {teamMembers.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center space-x-3 shadow"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {m.avatar}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">{m.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{m.roleTitle || m.role}</div>
                  <span className="inline-block mt-0.5 text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                    {m.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h2 className="text-sm font-bold text-white mb-3">新しいチームチャンネルを作成</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">チャンネル名</label>
                <input
                  type="text"
                  required
                  placeholder="例: 設計・アーキテクチャ検討"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">説明</label>
                <input
                  type="text"
                  placeholder="チャンネルの目的やトピック..."
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
