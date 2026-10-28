import React from 'react';
import { Shield, Check, X, Info, Users, Lock, CheckSquare, MessageSquare, Video, FolderLock } from 'lucide-react';
import { UserRole } from '../types';
import { ROLE_PERMISSIONS, ROLE_METADATA } from '../lib/permissions';

interface RoleMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const RoleMatrixModal: React.FC<RoleMatrixModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
}) => {
  if (!isOpen) return null;

  const permissionsList = [
    {
      category: 'タスク管理 (Task Management)',
      icon: CheckSquare,
      items: [
        { key: 'canCreateTask', label: '新規タスクの作成', desc: 'タイトル・期限・担当者・暗号化メモの設定' },
        { key: 'canEditTaskStatus', label: 'ステータスの更新', desc: 'To Do / In Progress / Review / Done の変更' },
        { key: 'canEditTaskDetails', label: 'タスク詳細の編集', desc: '優先度、期日、説明文の変更' },
        { key: 'canDeleteTask', label: 'タスクの完全削除', desc: 'データベースからのタスク破棄 (管理者限定)' },
      ],
    },
    {
      category: 'チャットアクセス (Chat Access)',
      icon: MessageSquare,
      items: [
        { key: 'canSendMessage', label: '暗号化メッセージの送信', desc: 'AES-256-GCMリアルタイム暗号化発言' },
        { key: 'canAttachFiles', label: 'ファイルの暗号化添付', desc: 'チャットメッセージへのファイル紐付け' },
        { key: 'canCreateChannel', label: '公式チャンネルの新規開設', desc: '全社/開発/プロジェクトチャンネルの作成' },
        { key: 'canDeleteMessage', label: '不適切メッセージの削除', desc: 'チャットスレッドのモデレーション' },
      ],
    },
    {
      category: 'ミーティング参加 (P2P Meetings)',
      icon: Video,
      items: [
        { key: 'canJoinMeeting', label: 'P2P会議への参加・視聴', desc: 'WebRTC暗号化メッシュ接続での通話' },
        { key: 'canScheduleMeeting', label: 'カレンダー会議予約', desc: 'P2Pルームコードの発行とメンバー招集' },
        { key: 'canStartInstantMeeting', label: '即時P2P会議の開始', desc: '「今すぐ開始」での緊急会議立ち上げ' },
        { key: 'canShareScreen', label: '画面共有 (Screen Sharing)', desc: '高解像度デスクトップ共有の配信' },
        { key: 'canEndMeetingForEveryone', label: '会議の強制終了', desc: '全参加者のルーム接続一括切断 (管理者限定)' },
      ],
    },
    {
      category: 'ファイル共有 (File Vault)',
      icon: FolderLock,
      items: [
        { key: 'canDownloadFile', label: 'ファイルの復号・閲覧', desc: '端末内でのAES-256復号ダウンロード' },
        { key: 'canUploadFile', label: '新規ファイルの暗号化保存', desc: '端末側でのバイナリ暗号化アップロード' },
        { key: 'canDeleteFile', label: 'ファイルの完全削除', desc: 'Vaultストレージからの完全破棄' },
      ],
    },
    {
      category: 'セキュリティ & ガバナンス',
      icon: Shield,
      items: [
        { key: 'canViewAuditLogs', label: '監査ログの閲覧', desc: 'セキュリティ操作およびRBAC追跡記録' },
        { key: 'canRotateMasterKey', label: 'マスター暗号鍵のローテーション', desc: 'パスフレーズ再導出による鍵更新 (管理者限定)' },
        { key: 'canManageUserRoles', label: 'ロール権限の割り当て・管理', desc: 'メンバーのロール昇格・降格管理' },
      ],
    },
  ];

  const roles: UserRole[] = ['admin', 'member', 'viewer'];

  return (
    <div
      id="role-matrix-modal-overlay"
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="role-matrix-modal-content"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>ロールベースアクセス制御 (RBAC) 権限マトリクス</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  3つのロール体系
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                各ロールごとのタスク、チャット、P2P会議、ファイル共有、セキュリティの実行権限一覧
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Role Quick Selector Banner */}
        <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 px-4 shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>テスト用ロール切り替え: クリックして即座にアクティブロールを体験できます</span>
          </span>

          <div className="flex items-center space-x-2">
            {roles.map((r) => {
              const meta = ROLE_METADATA[r];
              const isSelected = currentRole === r;
              return (
                <button
                  key={r}
                  onClick={() => onSelectRole(r)}
                  className={`px-3 py-1 text-xs rounded-lg font-semibold border transition flex items-center space-x-1.5 ${
                    isSelected
                      ? `${meta.badgeColor} ring-2 ring-indigo-500`
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{meta.label.split(' ')[0]}</span>
                  {isSelected && <span className="text-[10px] ml-1 bg-white/20 px-1 rounded">選択中</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Role Cards Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {roles.map((r) => {
              const meta = ROLE_METADATA[r];
              const isCurrent = currentRole === r;
              return (
                <div
                  key={r}
                  className={`p-3 rounded-xl border transition ${
                    isCurrent
                      ? 'bg-slate-850 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs">{meta.label}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${meta.badgeColor}`}>
                      {meta.badgeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{meta.description}</p>
                  <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-800">
                    <span className="text-slate-400 font-semibold">権限範囲:</span> {meta.scopeSummary}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Permissions Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
            <div className="grid grid-cols-12 bg-slate-850 p-3 font-semibold text-slate-300 border-b border-slate-800 text-[11px]">
              <div className="col-span-6">操作項目 / 権限スコープ</div>
              <div className="col-span-2 text-center text-rose-300">管理者 (Admin)</div>
              <div className="col-span-2 text-center text-indigo-300">メンバー (Member)</div>
              <div className="col-span-2 text-center text-amber-300">閲覧者 (Viewer)</div>
            </div>

            <div className="divide-y divide-slate-800/80">
              {permissionsList.map((cat, idx) => {
                const CategoryIcon = cat.icon;
                return (
                  <div key={idx} className="bg-slate-900/50">
                    <div className="px-3 py-2 bg-slate-950/40 text-[11px] font-bold text-slate-300 flex items-center space-x-2 border-b border-slate-800/40">
                      <CategoryIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{cat.category}</span>
                    </div>

                    {cat.items.map((item) => {
                      const adminAllowed = ROLE_PERMISSIONS.admin[item.key as keyof typeof ROLE_PERMISSIONS.admin];
                      const memberAllowed = ROLE_PERMISSIONS.member[item.key as keyof typeof ROLE_PERMISSIONS.member];
                      const viewerAllowed = ROLE_PERMISSIONS.viewer[item.key as keyof typeof ROLE_PERMISSIONS.viewer];

                      return (
                        <div
                          key={item.key}
                          className="grid grid-cols-12 p-2.5 items-center hover:bg-slate-800/30 transition text-xs"
                        >
                          <div className="col-span-6 pr-2">
                            <div className="font-medium text-slate-200">{item.label}</div>
                            <div className="text-[11px] text-slate-400">{item.desc}</div>
                          </div>

                          {/* Admin */}
                          <div className="col-span-2 flex justify-center">
                            {adminAllowed ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </span>
                            )}
                          </div>

                          {/* Member */}
                          <div className="col-span-2 flex justify-center">
                            {memberAllowed ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </span>
                            )}
                          </div>

                          {/* Viewer */}
                          <div className="col-span-2 flex justify-center">
                            {viewerAllowed ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-900/60 flex items-center justify-center" title="読み取り専用のため制限">
                                <X className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            サーバーAPI通信時もヘッダー認証およびロール制限が厳格に適用されます。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
