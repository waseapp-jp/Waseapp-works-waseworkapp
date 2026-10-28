import React, { useState } from 'react';
import {
  Search,
  ShieldCheck,
  Video,
  PlusCircle,
  Lock,
  Users,
  Shield,
  ChevronDown,
  Cloud,
  LogIn,
  LogOut,
  CheckCircle2,
  Building2,
  User as UserIcon,
  Settings,
  Share2,
  Check,
} from 'lucide-react';
import { NavigationTab, UserRole, User } from '../types';
import { ROLE_METADATA } from '../lib/permissions';

interface TopHeaderProps {
  onTabChange: (tab: NavigationTab) => void;
  onOpenNewTaskModal: () => void;
  onStartQuickMeeting: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  keyFingerprint: string;
  connectedUsersCount: number;
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onOpenRoleMatrix: () => void;
  firebaseUser?: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null } | null;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
  isFirestoreConnected?: boolean;
  onClearAllData?: () => void;
  onCorporateLogout?: () => void;
  currentUser?: User;
  currentTenantName?: string;
  isTenantAdmin?: boolean;
  onOpenProfileModal?: () => void;
  onOpenTenantSelectModal?: () => void;
  accessibleTenantsCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onTabChange,
  onOpenNewTaskModal,
  onStartQuickMeeting,
  searchQuery,
  onSearchChange,
  keyFingerprint,
  connectedUsersCount,
  currentRole,
  onChangeRole,
  onOpenRoleMatrix,
  firebaseUser,
  onSignInGoogle,
  onSignOutGoogle,
  isFirestoreConnected = true,
  onClearAllData,
  onCorporateLogout,
  currentUser,
  currentTenantName,
  isTenantAdmin = false,
  onOpenProfileModal,
  onOpenTenantSelectModal,
  accessibleTenantsCount = 1,
}) => {
  const currentRoleMeta = ROLE_METADATA[currentRole] || ROLE_METADATA.member;
  const [copiedShare, setCopiedShare] = useState(false);

  const handleCopyShareLink = () => {
    const currentOrigin = window.location.origin;
    const shareUrl = currentOrigin.includes('ais-dev-')
      ? currentOrigin.replace('ais-dev-', 'ais-pre-')
      : 'https://ais-pre-eid6edxtqoljoz4grdmor2-554926909913.asia-northeast1.run.app';

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    });
  };

  return (
    <header
      id="teams-top-header"
      className="h-12 bg-slate-900 border-b border-slate-800 text-slate-200 px-4 flex items-center justify-between z-20 shrink-0 gap-2 font-sans select-none"
    >
      {/* Left: Organization Title & Status & Tenant Switcher */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Tenant Switcher Button */}
        <button
          id="btn-tenant-switcher"
          onClick={onOpenTenantSelectModal}
          title="会社・ワークスペースを切り替える"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 hover:border-indigo-500/50 transition cursor-pointer group"
        >
          <Building2 className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition shrink-0" />
          <span className="font-bold text-xs tracking-tight truncate max-w-[140px] sm:max-w-[180px]">
            {currentTenantName || currentUser?.companyName || '株式会社Waseapp'}
          </span>
          {accessibleTenantsCount > 1 && (
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              {accessibleTenantsCount}社
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition shrink-0" />
        </button>

        {/* System Admin or Tenant Admin Console Button */}
        {(currentUser?.email?.toLowerCase() === 'aimutsu0120@gmail.com' ||
          currentUser?.isSystemAdmin ||
          currentUser?.role === 'admin' ||
          isTenantAdmin) && (
          <button
            id="btn-top-admin-console"
            onClick={() => onTabChange('admin_console')}
            title="会社管理コンソールを開く"
            className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 transition text-[11px] font-bold shadow-sm cursor-pointer shrink-0"
          >
            <Shield className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">管理コンソール</span>
          </button>
        )}

        {/* E2EE Security Shield Pill */}
        <button
          id="e2ee-status-badge"
          onClick={() => onTabChange('security')}
          title={`エンドツーエンド暗号化 (AES-256-GCM) 稼働中 | 指紋: ${keyFingerprint}`}
          className="hidden xl:flex items-center space-x-1.5 text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 px-2.5 py-0.5 rounded-full hover:bg-emerald-900/60 transition"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-[11px]">E2EE AES-256</span>
          <Lock className="w-2.5 h-2.5 text-emerald-400" />
        </button>

        {/* Firebase Cloud Connection Indicator */}
        <div
          id="firebase-cloud-status"
          title={isFirestoreConnected ? "Firebase Firestore リアルタイム双方向データベースに接続中" : "Firestore 接続中..."}
          className="hidden lg:flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/80"
        >
          <Cloud className="w-3 h-3 text-indigo-400" />
          <span className="font-mono text-[10px]">Firestore Live</span>
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            placeholder="タスク、メッセージ、暗号化ファイルを検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg pl-9 pr-8 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: Quick Actions & Live Presence */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* RBAC Role Switcher & Matrix Button */}
        <div className="hidden sm:flex items-center space-x-1 bg-slate-800/90 border border-slate-700 rounded-lg p-0.5 shrink-0">
          <div className="relative flex items-center">
            <Shield className="w-3.5 h-3.5 text-indigo-400 absolute left-2 pointer-events-none" />
            <select
              id="rbac-role-selector"
              value={currentRole}
              onChange={(e) => onChangeRole(e.target.value as UserRole)}
              className="pl-7 pr-6 py-1 bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer appearance-none whitespace-nowrap"
              title="ロール権限切り替え"
            >
              <option value="admin" className="bg-slate-900 text-white">管理者 (Admin)</option>
              <option value="member" className="bg-slate-900 text-white">メンバー (Member)</option>
              <option value="viewer" className="bg-slate-900 text-white">閲覧者 (Viewer)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>

          <button
            id="btn-open-role-matrix"
            onClick={onOpenRoleMatrix}
            title="ロール権限マトリクスを確認"
            className="px-2 py-0.5 text-[10px] rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 transition font-medium whitespace-nowrap shrink-0"
          >
            権限
          </button>
        </div>

        {/* Share / Invite Link Button */}
        <button
          id="btn-top-share-invite"
          onClick={handleCopyShareLink}
          title="友達を招待する共有URLをコピー"
          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">共有URLコピー済</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>招待URL</span>
            </>
          )}
        </button>

        {/* Quick New Task Button */}
        <button
          id="btn-quick-new-task"
          onClick={onOpenNewTaskModal}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition whitespace-nowrap shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">タスク追加</span>
        </button>

        {/* Instant P2P Meeting Launch Button */}
        <button
          id="btn-quick-start-meeting"
          onClick={onStartQuickMeeting}
          className="flex items-center space-x-1 px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm shadow-indigo-500/30 transition whitespace-nowrap shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">会議開始</span>
        </button>

        {/* User Profile Button (Click to edit profile) */}
        {currentUser && (
          <button
            id="btn-open-profile-edit"
            onClick={onOpenProfileModal}
            title="プロフィール設定 (名前・画像・ステータスを変更)"
            className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 hover:border-indigo-500/60 transition cursor-pointer shrink-0 group"
          >
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover border border-indigo-400/50"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[11px] font-semibold text-slate-200 max-w-[90px] truncate group-hover:text-indigo-300 transition hidden sm:inline">
              {currentUser.name}
            </span>
            <Settings className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 transition" />
          </button>
        )}

        {/* Corporate Logout Button */}
        {onCorporateLogout && (
          <button
            id="btn-corp-logout"
            onClick={onCorporateLogout}
            title="ログアウトしてログイン画面に戻る"
            className="flex items-center space-x-1 px-2 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition ml-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-medium hidden md:inline">ログアウト</span>
          </button>
        )}
      </div>
    </header>
  );
};

