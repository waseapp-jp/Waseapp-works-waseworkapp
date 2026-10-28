import React from 'react';
import {
  Bell,
  MessageSquare,
  Users,
  Calendar,
  CheckSquare,
  Video,
  FolderLock,
  ShieldCheck,
  Shield,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';
import { NavigationTab, User } from '../types';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  currentUser: User;
  onStatusChange: (status: User['status']) => void;
  unreadCount: number;
  unreadActivityCount?: number;
  activeTasksCount: number;
  isConnected: boolean;
  isInMeeting: boolean;
  isTenantAdmin?: boolean;
  onOpenProfileModal?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onStatusChange,
  unreadCount,
  unreadActivityCount = 0,
  activeTasksCount,
  isConnected,
  isInMeeting,
  isTenantAdmin = false,
  onOpenProfileModal,
}) => {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);

  interface NavItem {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    highlight?: boolean;
  }

  const navItems: NavItem[] = [
    { id: 'activity', label: 'アクティビティ', icon: Bell, badge: unreadActivityCount > 0 ? unreadActivityCount : undefined },
    { id: 'chat', label: 'チャット', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'teams', label: 'チーム', icon: Users },
    { id: 'calendar', label: '予定表', icon: Calendar },
    { id: 'tasks', label: 'タスク', icon: CheckSquare, badge: activeTasksCount > 0 ? activeTasksCount : undefined },
    { id: 'meetings', label: '会議 (P2P)', icon: Video, highlight: isInMeeting },
    { id: 'files', label: 'ファイル', icon: FolderLock },
    { id: 'security', label: 'セキュリティ', icon: ShieldCheck },
  ];

  if (
    currentUser.email?.toLowerCase() === 'aimutsu0120@gmail.com' ||
    currentUser.isSystemAdmin ||
    currentUser.role === 'admin' ||
    isTenantAdmin
  ) {
    navItems.push({
      id: 'admin_console',
      label: '管理コンソール',
      icon: Shield,
    });
  }

  const statusColors = {
    online: 'bg-emerald-500',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
    in_meeting: 'bg-purple-500',
  };

  const statusLabels = {
    online: '連絡可能',
    busy: '取り込み中',
    away: '一時退席',
    in_meeting: '会議中',
  };

  return (
    <aside
      id="main-teams-sidebar"
      className="w-18 md:w-20 h-full max-h-full overflow-hidden bg-slate-900 text-slate-300 flex flex-col items-center py-3 select-none z-30 shrink-0 border-r border-slate-800/80"
    >
      {/* App Logo */}
      <div
        id="app-logo-container"
        className="mb-4 flex flex-col items-center cursor-pointer group shrink-0"
        onClick={() => onTabChange('chat')}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
          <span className="text-lg tracking-wider">W</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 mt-1 tracking-tight">WaseWork</span>
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 w-full flex flex-col items-center space-y-1.5 px-1.5 overflow-y-auto overscroll-contain">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`w-full py-2 px-1 flex flex-col items-center justify-center rounded-xl relative transition-all group ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {/* Active left indicator pill */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'group-hover:text-slate-200'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border-2 border-slate-900 shadow">
                    {item.badge}
                  </span>
                ) : null}
                {item.highlight && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[10px] mt-1 text-center line-clamp-1 group-hover:text-slate-200">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Area: Connectivity & Profile */}
      <div className="w-full flex flex-col items-center pt-2 space-y-3 border-t border-slate-800/80 px-2">
        {/* Connection status indicator */}
        <div
          id="connection-indicator"
          title={isConnected ? 'リアルタイム暗号化パイプライン接続中' : '再接続待機中...'}
          className="flex items-center space-x-1 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded-full cursor-help"
        >
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-3 h-3 text-emerald-400" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <WifiOff className="w-3 h-3 text-rose-400" />
            </>
          )}
        </div>

        {/* User Avatar with Status Menu (Touch & Click enabled for iPad) */}
        <div className="relative">
          <button
            id="user-profile-btn"
            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
            title="ステータス・プロフィール設定"
            className="w-10 h-10 rounded-full bg-indigo-700 text-white font-semibold flex items-center justify-center text-xs relative hover:ring-2 hover:ring-indigo-400 active:scale-95 transition overflow-visible cursor-pointer"
          >
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()
            )}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                statusColors[currentUser.status]
              }`}
            />
          </button>

          {/* Status popup menu */}
          {isStatusMenuOpen && (
            <>
              {/* Backdrop dismiss for iPad */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsStatusMenuOpen(false)}
              />
              <div className="absolute left-14 bottom-0 bg-slate-800 border border-slate-700 rounded-2xl p-2.5 w-52 shadow-2xl z-50">
                <div className="px-2 py-1.5 border-b border-slate-700 mb-1.5">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentUser.roleTitle || currentUser.role}</div>
                </div>

                {onOpenProfileModal && (
                  <button
                    id="btn-nav-profile-edit"
                    onClick={() => {
                      setIsStatusMenuOpen(false);
                      onOpenProfileModal();
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs rounded-xl flex items-center space-x-2 text-indigo-300 hover:bg-indigo-950/80 active:bg-indigo-900 mb-1 border border-indigo-900/60 font-semibold cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>プロフィールを編集</span>
                  </button>
                )}

                <div className="text-[10px] text-slate-500 px-2 py-1 font-bold">ステータス変更</div>
                {(['online', 'busy', 'away', 'in_meeting'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onStatusChange(st);
                      setIsStatusMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 text-xs rounded-xl flex items-center space-x-2.5 cursor-pointer active:scale-98 transition ${
                      currentUser.status === st ? 'bg-indigo-600/30 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${statusColors[st]}`} />
                    <span>{statusLabels[st]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
