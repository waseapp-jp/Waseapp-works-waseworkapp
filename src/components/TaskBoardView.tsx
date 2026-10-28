import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  MoreVertical,
  Trash2,
  Share2,
  Lock,
  User as UserIcon,
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import { hasPermission } from '../lib/permissions';

interface TaskBoardViewProps {
  tasks: Task[];
  currentUser: User;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onShareTaskToChat: (task: Task) => void;
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  tasks,
  currentUser,
  onUpdateTaskStatus,
  onDeleteTask,
  onCreateTask,
  onShareTaskToChat,
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]
  );
  const [channelId, setChannelId] = useState('general');
  const [encryptedNotes, setEncryptedNotes] = useState('');

  const columns: { id: TaskStatus; label: string; color: string; icon: any }[] = [
    { id: 'todo', label: '未着手 (To Do)', color: 'border-slate-700 bg-slate-900/60', icon: Clock },
    { id: 'in_progress', label: '進行中 (In Progress)', color: 'border-indigo-800 bg-indigo-950/20', icon: AlertCircle },
    { id: 'review', label: 'レビュー中 (Review)', color: 'border-amber-800 bg-amber-950/20', icon: Clock },
    { id: 'done', label: '完了 (Done)', color: 'border-emerald-800 bg-emerald-950/20', icon: CheckCircle2 },
  ];

  const priorityStyles: Record<TaskPriority, { label: string; badge: string }> = {
    urgent: { label: '緊急', badge: 'bg-rose-950/80 text-rose-300 border-rose-800' },
    high: { label: '高', badge: 'bg-orange-950/80 text-orange-300 border-orange-800' },
    medium: { label: '中', badge: 'bg-blue-950/80 text-blue-300 border-blue-800' },
    low: { label: '低', badge: 'bg-slate-800 text-slate-400 border-slate-700' },
  };

  const filteredTasks = tasks.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchSearch && matchPriority;
  });

  const canCreate = hasPermission(currentUser.role, 'canCreateTask');
  const canEditStatus = hasPermission(currentUser.role, 'canEditTaskStatus');
  const canDelete = hasPermission(currentUser.role, 'canDeleteTask');

  const handleSubmitNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !title.trim()) return;

    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      status: 'todo',
      priority,
      assignee: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
      },
      dueDate,
      channelId,
      encryptedNotes: encryptedNotes.trim() || undefined,
    });

    // Reset
    setTitle('');
    setDescription('');
    setEncryptedNotes('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <h1 className="text-base font-bold text-white tracking-tight">タスク・業務管理 (Planner)</h1>
          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
            計 {tasks.length} 件
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Priority filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">すべての優先度</option>
              <option value="urgent">緊急のみ</option>
              <option value="high">優先度: 高</option>
              <option value="medium">優先度: 中</option>
              <option value="low">優先度: 低</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="タスクを絞り込み..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* New Task Button */}
          <button
            id="btn-open-new-task-modal"
            disabled={!canCreate}
            onClick={() => setIsCreateModalOpen(true)}
            title={!canCreate ? "閲覧者 (Viewer) はタスク作成権限がありません" : "新しいタスクを作成"}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold shadow transition ${
              canCreate
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>タスク作成</span>
            {!canCreate && <Lock className="w-3 h-3 ml-1" />}
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto p-4 flex space-x-4">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const ColIcon = col.icon;

          return (
            <div
              key={col.id}
              className={`w-72 md:w-80 flex flex-col shrink-0 rounded-xl border ${col.color} backdrop-blur-sm shadow-sm overflow-hidden`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center space-x-2">
                  <ColIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-200">{col.label}</h3>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List in Column */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
                {colTasks.length === 0 ? (
                  <div className="h-32 border border-dashed border-slate-800 rounded-lg flex items-center justify-center text-[11px] text-slate-500">
                    タスクはありません
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-3 shadow hover:shadow-indigo-500/10 transition group"
                    >
                      {/* Priority and Channel tags */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            priorityStyles[task.priority].badge
                          }`}
                        >
                          {priorityStyles[task.priority].label}
                        </span>

                        <div className="flex items-center space-x-1">
                          {task.encryptedNotes && (
                            <span
                              title="暗号化メモ付き"
                              className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>E2EE</span>
                            </span>
                          )}
                          <button
                            onClick={() => onShareTaskToChat(task)}
                            className="text-slate-400 hover:text-indigo-400 p-1"
                            title="チャットに共有"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="text-slate-400 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                              title="タスク削除 (管理者限定)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Task Title */}
                      <h4 className="text-xs font-bold text-slate-100 mb-1 leading-snug">{task.title}</h4>

                      {/* Description */}
                      {task.description && (
                        <p className="text-[11px] text-slate-400 mb-2 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Footer: Due date & Assignee & Quick Move */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center space-x-1 text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{task.dueDate}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div
                            className="w-5 h-5 rounded-full bg-indigo-700 text-white text-[10px] font-bold flex items-center justify-center"
                            title={task.assignee.name}
                          >
                            {task.assignee.avatar}
                          </div>

                          {/* Next Status Advance Button */}
                          {col.id !== 'done' && canEditStatus && (
                            <button
                              onClick={() => {
                                const nextStatus: Record<TaskStatus, TaskStatus> = {
                                  todo: 'in_progress',
                                  in_progress: 'review',
                                  review: 'done',
                                  done: 'done',
                                };
                                onUpdateTaskStatus(task.id, nextStatus[task.status]);
                              }}
                              className="text-slate-400 hover:text-indigo-300 p-1 bg-slate-800 rounded hover:bg-slate-700"
                              title="次のステージへ進める"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>新規タスク作成</span>
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewTask} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">タスク名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: P2P通信の暗号化ハンドシェイク検証"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">詳細説明</label>
                <textarea
                  rows={3}
                  placeholder="具体的な手順やゴールを記載..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">優先度</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="urgent">緊急 (Urgent)</option>
                    <option value="high">高 (High)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="low">低 (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">期限日</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>機密・暗号化メモ (オプション)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400">端末内AES-256暗号化</span>
                </label>
                <input
                  type="text"
                  placeholder="認証キーや機密URLなど、暗号化して保存する情報..."
                  value={encryptedNotes}
                  onChange={(e) => setEncryptedNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
                >
                  タスクを登録
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
