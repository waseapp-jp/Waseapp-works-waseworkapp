import React from 'react';
import { Bell, MessageSquare, CheckSquare, Video, FolderLock, ShieldCheck, ArrowRight, Inbox } from 'lucide-react';
import { NavigationTab, Task, AuditLog } from '../types';

interface ActivityViewProps {
  onNavigate: (tab: NavigationTab) => void;
  tasks: Task[];
  auditLogs?: AuditLog[];
  unreadCount: number;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ onNavigate, tasks, auditLogs = [], unreadCount }) => {
  // Generate real dynamic activities from tasks and audit logs
  const activities = [
    ...tasks.map((t) => ({
      id: `act-task-${t.id}`,
      icon: CheckSquare,
      color: 'text-amber-400 bg-amber-950/80 border-amber-800',
      title: `タスク「${t.title}」: ステータス [${t.status}]`,
      time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '最近',
      action: () => onNavigate('tasks'),
      btnText: 'タスクを見る',
    })),
    ...auditLogs.slice(0, 10).map((log) => ({
      id: `act-log-${log.id}`,
      icon: ShieldCheck,
      color: 'text-indigo-400 bg-indigo-950/80 border-indigo-800',
      title: `${log.action}: ${log.detail}`,
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: () => onNavigate('security'),
      btnText: '監査ログ',
    })),
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          <h1 className="text-base font-bold text-white tracking-tight">アクティビティ・フィード</h1>
        </div>
        <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
          通知: {unreadCount} 件
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full space-y-3">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-1">新しいアクティビティはありません</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              チャットの送信、タスクの登録、またはP2P会議を開始すると、ここに最新の活動履歴が表示されます。
            </p>
          </div>
        ) : (
          activities.map((act) => {
            const Icon = act.icon;
            return (
              <div
                key={act.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center justify-between shadow transition"
              >
                <div className="flex items-center space-x-3.5">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${act.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">{act.title}</p>
                    <span className="text-[11px] text-slate-500">{act.time}</span>
                  </div>
                </div>

                <button
                  onClick={act.action}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  <span>{act.btnText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
