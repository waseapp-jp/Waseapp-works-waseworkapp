import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Users,
  AlertCircle,
  Lock,
  ArrowRight,
  Filter,
  CheckCircle2,
  Share2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ScheduledMeeting, Task, User, UserRole } from '../types';
import { hasPermission } from '../lib/permissions';

interface CalendarViewProps {
  meetings: ScheduledMeeting[];
  tasks: Task[];
  currentUser: User;
  onJoinMeeting: (roomId: string) => void;
  onScheduleMeeting: (meetingData: Omit<ScheduledMeeting, 'id' | 'createdAt'>) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onCreateTaskWithDeadline: (title: string, dueDate: string, priority: Task['priority']) => void;
  onOpenTaskDetails?: (task: Task) => void;
}

type CalendarFilter = 'all' | 'meetings' | 'tasks';
type CalendarTabMode = 'month' | 'week' | 'availability' | 'agenda';

export const CalendarView: React.FC<CalendarViewProps> = ({
  meetings,
  tasks,
  currentUser,
  onJoinMeeting,
  onScheduleMeeting,
  onDeleteMeeting,
  onCreateTaskWithDeadline,
  onOpenTaskDetails,
}) => {
  // Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 21)); // September 21, 2026
  const [tabMode, setTabMode] = useState<CalendarTabMode>('month');
  const [filterType, setFilterType] = useState<CalendarFilter>('all');
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-09-21');

  // Modal State for scheduling P2P meeting
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('2026-09-21');
  const [newStartTime, setNewStartTime] = useState('14:00');
  const [newEndTime, setNewEndTime] = useState('15:00');
  const [newRoomId, setNewRoomId] = useState(`WASE-${Math.floor(100 + Math.random() * 900)}`);
  const [newChannelId, setNewChannelId] = useState('general');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([currentUser.id]);

  // Quick Task Deadline Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');

  // Selected Item details for side panel
  const [selectedMeeting, setSelectedMeeting] = useState<ScheduledMeeting | null>(null);

  // RBAC permission checks
  const canSchedule = hasPermission(currentUser.role, 'canScheduleMeeting');
  const canCreateTask = hasPermission(currentUser.role, 'canCreateTask');

  // Team members availability data
  const teamMembers = [
    {
      id: currentUser.id,
      name: `${currentUser.name} (${currentUser.roleTitle || currentUser.role})`,
      avatar: currentUser.avatar,
      status: currentUser.status,
      busySlots: [] as string[],
    },
  ];

  // Helper date calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed (8 = September)

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 8, 21));
    setSelectedDateStr('2026-09-21');
  };

  // Submit Schedule Meeting
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSchedule || !newTitle.trim()) return;

    const participants = selectedParticipants.map((pid) => {
      const member = teamMembers.find((m) => m.id === pid);
      return {
        id: pid,
        name: member?.name || '参加者',
        avatar: member?.avatar || 'U',
        status: 'accepted' as const,
      };
    });

    onScheduleMeeting({
      title: newTitle.trim(),
      description: newDesc.trim(),
      roomId: newRoomId.trim().toUpperCase(),
      startTime: `${newDate}T${newStartTime}`,
      endTime: `${newDate}T${newEndTime}`,
      date: newDate,
      hostId: currentUser.id,
      hostName: currentUser.name,
      hostAvatar: currentUser.avatar,
      channelId: newChannelId,
      participants,
      isEncrypted: true,
    });

    setIsMeetingModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewRoomId(`WASE-${Math.floor(100 + Math.random() * 900)}`);
  };

  // Submit Quick Task with Deadline
  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTask || !newTaskTitle.trim()) return;

    onCreateTaskWithDeadline(newTaskTitle.trim(), selectedDateStr, newTaskPriority);
    setIsTaskModalOpen(false);
    setNewTaskTitle('');
  };

  // Filtered items
  const getItemsForDate = (dateString: string) => {
    const dayMeetings = meetings.filter((m) => m.date === dateString);
    const dayTasks = tasks.filter((t) => t.dueDate === dateString);

    if (filterType === 'meetings') return { meetings: dayMeetings, tasks: [] };
    if (filterType === 'tasks') return { meetings: [], tasks: dayTasks };
    return { meetings: dayMeetings, tasks: dayTasks };
  };

  // Week View calculation (7 days starting around current date)
  const getWeekDays = () => {
    const days: { dateStr: string; dayNum: number; dayName: string; isToday: boolean }[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // Start from Sunday of current week
    const currentDay = currentDate.getDate();
    const currentDayOfWeek = currentDate.getDay();
    const sundayDate = currentDay - currentDayOfWeek;

    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month, sundayDate + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: d.getDate(),
        dayName: dayNames[i],
        isToday: dStr === '2026-09-21',
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>カレンダー & 予定表</span>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 border border-indigo-800 px-2 py-0.5 rounded">
                P2Pミーティング & タスク期日同期
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              暗号化P2P会議のスケジュール設定、タスク締切の可視化、チーム空き時間の確認
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Schedule Meeting Button */}
          <button
            id="btn-schedule-p2p-meeting"
            disabled={!canSchedule}
            onClick={() => {
              setNewDate(selectedDateStr || '2026-09-21');
              setIsMeetingModalOpen(true);
            }}
            title={!canSchedule ? '閲覧者 (Viewer) はミーティングの新規予約権限がありません' : 'P2P会議を予約'}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold shadow transition ${
              canSchedule
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>P2P会議を予約</span>
            {!canSchedule && <Lock className="w-3 h-3 ml-1" />}
          </button>

          {/* Quick Add Task with Deadline */}
          <button
            id="btn-schedule-task-deadline"
            disabled={!canCreateTask}
            onClick={() => setIsTaskModalOpen(true)}
            title={!canCreateTask ? '閲覧者 (Viewer) はタスク作成権限がありません' : 'この日にタスク期日を設定'}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold border transition ${
              canCreateTask
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-900 text-slate-600 cursor-not-allowed border-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>タスク期日追加</span>
          </button>
        </div>
      </div>

      {/* Secondary Bar: Navigation, Views, Filters */}
      <div className="h-12 px-4 bg-slate-925 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Date Month Selector */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium border border-slate-700 transition"
          >
            今日 (9月21日)
          </button>

          <div className="flex items-center space-x-1 bg-slate-850 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-750 text-slate-400 hover:text-white rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white px-2 font-mono">
              {year}年 {month + 1}月
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-750 text-slate-400 hover:text-white rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs: Month, Week, Availability, Agenda */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setTabMode('month')}
            className={`px-3 py-1 rounded-md transition ${
              tabMode === 'month' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            月表示
          </button>
          <button
            onClick={() => setTabMode('week')}
            className={`px-3 py-1 rounded-md transition ${
              tabMode === 'week' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            週表示
          </button>
          <button
            onClick={() => setTabMode('availability')}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
              tabMode === 'availability'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>チーム空き状況</span>
          </button>
          <button
            onClick={() => setTabMode('agenda')}
            className={`px-3 py-1 rounded-md transition ${
              tabMode === 'agenda' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            アジェンダ
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filterType === 'all' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setFilterType('meetings')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filterType === 'meetings' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            P2P会議のみ ({meetings.length})
          </button>
          <button
            onClick={() => setFilterType('tasks')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filterType === 'tasks' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            タスク期日のみ ({tasks.length})
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4">
          {/* MONTH VIEW */}
          {tabMode === 'month' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col flex-1">
              {/* Days of week header */}
              <div className="grid grid-cols-7 bg-slate-850 border-b border-slate-800 text-[11px] font-bold text-slate-400 text-center py-2">
                <span className="text-rose-400">日</span>
                <span>月</span>
                <span>火</span>
                <span>水</span>
                <span>木</span>
                <span>金</span>
                <span className="text-indigo-400">土</span>
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-800/80 bg-slate-950/40">
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] p-1.5 bg-slate-900/30 text-slate-700 text-xs" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = dateStr === '2026-09-21';
                  const isSelected = selectedDateStr === dateStr;
                  const { meetings: dayMeetings, tasks: dayTasks } = getItemsForDate(dateStr);

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={`min-h-[100px] p-2 flex flex-col justify-between transition cursor-pointer group ${
                        isSelected
                          ? 'bg-indigo-950/40 border-2 border-indigo-500/80'
                          : isToday
                          ? 'bg-indigo-950/20'
                          : 'hover:bg-slate-850/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isToday
                              ? 'bg-indigo-600 text-white shadow'
                              : isSelected
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 group-hover:text-white'
                          }`}
                        >
                          {dayNum}
                        </span>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                          {canSchedule && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewDate(dateStr);
                                setIsMeetingModalOpen(true);
                              }}
                              title="この日に会議を予約"
                              className="w-5 h-5 rounded bg-indigo-900/80 hover:bg-indigo-800 text-indigo-300 flex items-center justify-center text-[10px]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Event Chips List */}
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                        {/* P2P Meetings Chips */}
                        {dayMeetings.map((m) => (
                          <div
                            key={m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeeting(m);
                            }}
                            title={`P2P会議: ${m.title} (${m.startTime.slice(11, 16)} - ${m.endTime.slice(11, 16)})`}
                            className="bg-indigo-900/70 hover:bg-indigo-800/80 border border-indigo-700/60 rounded px-1.5 py-0.5 text-[10px] text-indigo-200 flex items-center justify-between truncate shadow-xs transition"
                          >
                            <span className="flex items-center gap-1 truncate">
                              <Video className="w-2.5 h-2.5 text-indigo-300 shrink-0" />
                              <span className="truncate">{m.title}</span>
                            </span>
                            <span className="font-mono text-[9px] text-indigo-300 shrink-0 ml-1">
                              {m.startTime.slice(11, 16)}
                            </span>
                          </div>
                        ))}

                        {/* Task Deadlines Chips */}
                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTaskDetails?.(t);
                            }}
                            title={`タスク期日: ${t.title} [優先度: ${t.priority}]`}
                            className={`rounded px-1.5 py-0.5 text-[10px] flex items-center justify-between truncate border shadow-xs transition ${
                              t.status === 'done'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 line-through opacity-70'
                                : t.priority === 'urgent'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <CheckSquare className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </span>
                            <span className="text-[9px] font-mono shrink-0 ml-1">
                              {t.priority === 'urgent' ? '緊急' : '締切'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Day summary count footer */}
                      <div className="text-[9px] text-slate-500 pt-0.5 flex justify-end gap-1 font-mono">
                        {dayMeetings.length > 0 && <span>{dayMeetings.length} 会議</span>}
                        {dayTasks.length > 0 && <span>{dayTasks.length} タスク</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {tabMode === 'week' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col flex-1">
              <div className="grid grid-cols-7 bg-slate-850 border-b border-slate-800 text-center py-2 divide-x divide-slate-800">
                {weekDays.map((d) => (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedDateStr(d.dateStr)}
                    className={`p-1 cursor-pointer transition ${
                      d.isToday ? 'text-indigo-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400">{d.dayName}曜日</div>
                    <div className="text-sm font-mono mt-0.5">{d.dayNum}日</div>
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              <div className="grid grid-cols-7 flex-1 divide-x divide-slate-800 min-h-[450px]">
                {weekDays.map((d) => {
                  const { meetings: dayMeetings, tasks: dayTasks } = getItemsForDate(d.dateStr);
                  const isSelected = selectedDateStr === d.dateStr;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setSelectedDateStr(d.dateStr)}
                      className={`p-2 space-y-2 cursor-pointer transition flex flex-col ${
                        isSelected ? 'bg-indigo-950/20' : 'hover:bg-slate-850/30'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center">
                        <span>予定リスト</span>
                        {canSchedule && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewDate(d.dateStr);
                              setIsMeetingModalOpen(true);
                            }}
                            className="text-indigo-400 hover:text-white"
                          >
                            +
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto">
                        {dayMeetings.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMeeting(m)}
                            className="bg-indigo-950/80 border border-indigo-800 hover:border-indigo-600 rounded-lg p-2 text-xs shadow transition"
                          >
                            <div className="flex items-center space-x-1.5 text-indigo-300 font-semibold mb-1">
                              <Video className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="truncate">{m.title}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {m.startTime.slice(11, 16)} - {m.endTime.slice(11, 16)}
                            </div>
                            <div className="mt-1.5 pt-1.5 border-t border-indigo-900/60 flex items-center justify-between text-[10px]">
                              <span className="font-mono text-indigo-300">{m.roomId}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onJoinMeeting(m.roomId);
                                }}
                                className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold"
                              >
                                参加
                              </button>
                            </div>
                          </div>
                        ))}

                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            className="bg-slate-850 border border-slate-700 rounded-lg p-2 text-xs shadow"
                          >
                            <div className="flex items-center space-x-1.5 text-slate-200 font-medium mb-1">
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="truncate">{t.title}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex justify-between">
                              <span>期日: 当日中</span>
                              <span className="text-rose-400 font-semibold uppercase">{t.priority}</span>
                            </div>
                          </div>
                        ))}

                        {dayMeetings.length === 0 && dayTasks.length === 0 && (
                          <div className="text-[11px] text-slate-600 text-center py-6">予定なし</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AVAILABILITY (FREE/BUSY) VIEW */}
          {tabMode === 'availability' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-col flex-1 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>チームメンバー空き時間タイムライン (Availability Grid)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    対象日: {selectedDateStr} | メンバーの空きスロットを確認してP2P会議を最適に調整
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-800 inline-block" />
                    <span>空き (Free)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-indigo-600/80 border border-indigo-500 inline-block" />
                    <span>会議予定 (Busy)</span>
                  </span>
                </div>
              </div>

              {/* Time slots header: 09:00 to 18:00 */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/60">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-11 border-b border-slate-800 text-[10px] text-slate-400 font-mono py-2 px-3">
                    <div className="col-span-2 text-slate-300 font-bold">メンバー</div>
                    <div>09:00</div>
                    <div>10:00</div>
                    <div>11:00</div>
                    <div>12:00</div>
                    <div>13:00</div>
                    <div>14:00</div>
                    <div>15:00</div>
                    <div>16:00</div>
                    <div>17:00</div>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-11 items-center py-2.5 px-3 hover:bg-slate-900/60 transition"
                      >
                        <div className="col-span-2 flex items-center space-x-2 truncate pr-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {member.avatar}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate">{member.name}</div>
                            <span className="text-[10px] text-slate-400 capitalize">{member.status}</span>
                          </div>
                        </div>

                        {/* 9 hours slots */}
                        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(
                          (time) => {
                            const isBusy =
                              member.busySlots.some((slot) => slot.includes(time.slice(0, 2))) ||
                              (selectedDateStr === '2026-09-21' && time === '15:00'); // 15:00 is WASE-MAIN meeting

                            return (
                              <div key={time} className="h-8 px-0.5">
                                <div
                                  className={`w-full h-full rounded border flex items-center justify-center text-[9px] font-mono transition ${
                                    isBusy
                                      ? 'bg-indigo-600/60 border-indigo-500 text-white shadow-xs'
                                      : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/40'
                                  }`}
                                >
                                  {isBusy ? '予定あり' : '空き'}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommended meeting time */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-slate-200">
                    全員が参加可能な推奨時間帯: <strong className="text-indigo-300 font-mono">13:00〜14:00</strong> または <strong className="text-indigo-300 font-mono">16:30〜17:30</strong>
                  </span>
                </div>
                {canSchedule && (
                  <button
                    onClick={() => {
                      setNewStartTime('13:00');
                      setNewEndTime('14:00');
                      setIsMeetingModalOpen(true);
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow"
                  >
                    この時間で予約
                  </button>
                )}
              </div>
            </div>
          )}

          {/* AGENDA LIST VIEW */}
          {tabMode === 'agenda' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-col flex-1 space-y-4 overflow-y-auto">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>直近のP2Pミーティング & タスク期日アジェンダ一覧</span>
              </h3>

              <div className="space-y-3">
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-950 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-3.5 flex items-center justify-between transition shadow"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-white">{m.title}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-800">
                            {m.roomId}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{m.description}</p>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-3 font-mono">
                          <span>日時: {m.date} {m.startTime.slice(11, 16)}〜{m.endTime.slice(11, 16)}</span>
                          <span>主催: {m.hostName}</span>
                          <span>参加者: {m.participants.length}名</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => onJoinMeeting(m.roomId)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>P2P会議に参加</span>
                      </button>
                      {hasPermission(currentUser.role, 'canScheduleMeeting') && (
                        <button
                          onClick={() => onDeleteMeeting(m.id)}
                          title="会議をキャンセル"
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-white">{t.title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                            t.priority === 'urgent'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t.description}</p>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">
                          期日: {t.dueDate} | 担当: {t.assignee.name}
                        </div>
                      </div>
                    </div>

                    <span className={`text-xs px-2.5 py-1 rounded font-semibold ${
                      t.status === 'done' ? 'text-emerald-400 bg-emerald-950' : 'text-slate-300 bg-slate-800'
                    }`}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Panel: Details of Selected Date or Meeting */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/70 p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="border-b border-slate-800 pb-3 mb-3">
            <h3 className="text-xs font-bold text-white">
              選択日のスケジュール詳細 ({selectedDateStr})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              P2P暗号化会議 & タスク期限
            </span>
          </div>

          {selectedMeeting ? (
            <div className="space-y-3 bg-slate-850 p-3 rounded-xl border border-indigo-800/80 mb-4 shadow">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  P2P ミーティング
                </span>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white">{selectedMeeting.title}</h4>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {selectedMeeting.description}
                </p>
              </div>

              <div className="space-y-1 text-[11px] font-mono text-slate-400 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div>ルームコード: <span className="text-indigo-300 font-bold">{selectedMeeting.roomId}</span></div>
                <div>時間: {selectedMeeting.startTime.slice(11, 16)}〜{selectedMeeting.endTime.slice(11, 16)}</div>
                <div>ホスト: {selectedMeeting.hostName}</div>
                <div>暗号化: DTLS 1.3 + AES-256</div>
              </div>

              <button
                onClick={() => onJoinMeeting(selectedMeeting.roomId)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow"
              >
                <Video className="w-4 h-4" />
                <span>今すぐこの会議に参加</span>
              </button>
            </div>
          ) : null}

          {/* Items for selected date */}
          <div className="flex-1 space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedDateStr} の予定 ({getItemsForDate(selectedDateStr).meetings.length + getItemsForDate(selectedDateStr).tasks.length}件)
            </h4>

            {getItemsForDate(selectedDateStr).meetings.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl p-3 cursor-pointer transition shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-indigo-300 truncate">{m.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {m.startTime.slice(11, 16)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">ルーム: {m.roomId}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoinMeeting(m.roomId);
                  }}
                  className="mt-2 w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded flex items-center justify-center gap-1"
                >
                  <Video className="w-3 h-3" />
                  <span>参加</span>
                </button>
              </div>
            ))}

            {getItemsForDate(selectedDateStr).tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenTaskDetails?.(t)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200 truncate">{t.title}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">期日</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">{t.description}</div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                  <span>担当: {t.assignee.name}</span>
                  <span className="text-indigo-400 font-semibold uppercase">{t.status}</span>
                </div>
              </div>
            ))}

            {getItemsForDate(selectedDateStr).meetings.length === 0 &&
              getItemsForDate(selectedDateStr).tasks.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-8">
                  この日のミーティングやタスク期日はありません
                </div>
              )}
          </div>
        </div>
      </div>

      {/* SCHEDULE MEETING MODAL */}
      {isMeetingModalOpen && (
        <div
          id="schedule-meeting-modal"
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">新しいP2P暗号化ミーティングを予約</h3>
              </div>
              <button
                onClick={() => setIsMeetingModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">会議タイトル *</label>
                <input
                  type="text"
                  required
                  placeholder="例: セキュリティ要件定義 & アーキテクチャ確認"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">会議アジェンダ・説明</label>
                <textarea
                  rows={2}
                  placeholder="議題、事前共有資料、アジェンダ項目..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">開催日</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">開始時刻</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">終了時刻</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">P2Pルームコード</label>
                  <input
                    type="text"
                    required
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-indigo-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">関連チャンネル</label>
                  <select
                    value={newChannelId}
                    onChange={(e) => setNewChannelId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="general">一般 (General)</option>
                    <option value="dev">開発・エンジニアリング</option>
                    <option value="projects">プロジェクト進行 (Sprint)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">招集メンバー (複数選択)</label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 max-h-32 overflow-y-auto">
                  {teamMembers.map((m) => {
                    const isChecked = selectedParticipants.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants((prev) => [...prev, m.id]);
                            } else {
                              setSelectedParticipants((prev) => prev.filter((id) => id !== m.id));
                            }
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Lock className="w-3 h-3" /> E2EE WebRTC P2P会議
                </span>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsMeetingModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow"
                  >
                    カレンダーに登録
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK TASK DEADLINE MODAL */}
      {isTaskModalOpen && (
        <div
          id="quick-task-modal"
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">タスク締め切り日をカレンダーに登録</h3>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">タスク名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: Q3暗号化鍵の第三者監査報告書の受領"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">締め切り日</label>
                  <input
                    type="date"
                    value={selectedDateStr}
                    onChange={(e) => setSelectedDateStr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">優先度</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">低 (Low)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="high">高 (High)</option>
                    <option value="urgent">緊急 (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow"
                >
                  タスク締切を追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
