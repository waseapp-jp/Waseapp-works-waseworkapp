import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  Database,
  ArrowRight,
  RefreshCw,
  X,
  Mail,
  Users,
  MessageSquare,
  CheckSquare,
  Video,
  FileText,
  Activity,
  AlertCircle,
  Globe,
  Terminal,
  Copy,
  ExternalLink,
  UserPlus,
  UserCheck,
  Shield,
  Key,
} from 'lucide-react';
import { User, Tenant, AuditLog } from '../types';

interface AdminConsoleProps {
  currentUser: User;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  onSelectTenant: (tenant: Tenant) => void;
  onCreateTenant: (name: string, adminEmail: string) => Promise<void>;
  onDeleteTenant: (tenantId: string) => Promise<void>;
  onUpdateTenantAllowedEmails: (tenantId: string, allowedEmails: string[]) => Promise<void>;
  onEnterWorkspace: () => void;
  dbStats: {
    isFirestoreConnected: boolean;
    tenantsCount: number;
    usersCount: number;
    messagesCount: number;
    tasksCount: number;
    meetingsCount: number;
    filesCount: number;
    auditLogsCount: number;
  };
  auditLogs: AuditLog[];
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  currentUser,
  tenants,
  currentTenant,
  onSelectTenant,
  onCreateTenant,
  onDeleteTenant,
  onUpdateTenantAllowedEmails,
  onEnterWorkspace,
  dbStats,
  auditLogs,
}) => {
  // Modals & form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Managing members for a specific tenant modal
  const [selectedTenantForMembers, setSelectedTenantForMembers] = useState<Tenant | null>(null);

  // Input for adding allowed email
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(label);
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  // Check roles
  const isSystemAdmin =
    currentUser.email?.toLowerCase() === 'aimutsu0120@gmail.com' || currentUser.isSystemAdmin || currentUser.role === 'admin';
  const isCurrentTenantAdmin =
    isSystemAdmin ||
    currentUser.role === 'admin' ||
    (currentTenant && (
      currentUser.email?.toLowerCase() === currentTenant.adminEmail?.toLowerCase() ||
      currentTenant.createdBy === currentUser.id ||
      currentTenant.createdBy === currentUser.email
    ));

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || !newAdminEmail.trim()) {
      setErrorMsg('会社名と管理者メールアドレスを入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onCreateTenant(newTenantName.trim(), newAdminEmail.trim().toLowerCase());
      setSuccessMsg(`テナント「${newTenantName.trim()}」を追加しました。`);
      setNewTenantName('');
      setNewAdminEmail('');
      setIsCreateModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('テナントの作成に失敗しました: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (tenant.id === 'waseapp-primary') {
      alert('初期テナントは削除できません。');
      return;
    }
    if (confirm(`本当にテナント「${tenant.name}」を削除しますか？`)) {
      try {
        await onDeleteTenant(tenant.id);
        setSuccessMsg(`テナント「${tenant.name}」を削除しました。`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        alert('削除に失敗しました: ' + (err.message || ''));
      }
    }
  };

  // Add allowed member email to a tenant
  const handleAddMemberEmail = async (tenant: Tenant, emailToAdd: string) => {
    const rawEmails = emailToAdd
      .split(/[,;\s\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (rawEmails.length === 0) {
      setErrorMsg('有効なメールアドレスを入力してください。');
      return;
    }

    const validEmails = rawEmails.filter((e) => e.includes('@'));
    if (validEmails.length === 0) {
      setErrorMsg('有効なメールアドレス形式を入力してください (例: user@company.com)。');
      return;
    }

    const currentAllowed = tenant.allowedEmails || [];
    const newUniqueEmails = validEmails.filter(
      (e) => !currentAllowed.includes(e) && tenant.adminEmail?.toLowerCase() !== e
    );

    if (newUniqueEmails.length === 0) {
      setErrorMsg('入力されたメールアドレスはすべて既に登録されています。');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const updatedList = [...currentAllowed, ...newUniqueEmails];
      await onUpdateTenantAllowedEmails(tenant.id, updatedList);

      if (selectedTenantForMembers && selectedTenantForMembers.id === tenant.id) {
        setSelectedTenantForMembers({
          ...selectedTenantForMembers,
          allowedEmails: updatedList,
        });
      }

      setSuccessMsg(`「${newUniqueEmails.join(', ')}」をアクセス許可メンバーに追加しました。`);
      setNewMemberEmail('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('メンバーの追加に失敗しました: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove allowed member email from a tenant
  const handleRemoveMemberEmail = async (tenant: Tenant, emailToRemove: string) => {
    if (confirm(`「${emailToRemove}」のアクセス権限を解除しますか？`)) {
      try {
        setIsSubmitting(true);
        const currentAllowed = tenant.allowedEmails || [];
        const updatedList = currentAllowed.filter((e) => e.toLowerCase() !== emailToRemove.toLowerCase());
        await onUpdateTenantAllowedEmails(tenant.id, updatedList);

        if (selectedTenantForMembers && selectedTenantForMembers.id === tenant.id) {
          setSelectedTenantForMembers({
            ...selectedTenantForMembers,
            allowedEmails: updatedList,
          });
        }

        setSuccessMsg(`「${emailToRemove}」のアクセス権限を解除しました。`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg('メンバー権限の削除に失敗しました: ' + (err.message || ''));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Target tenant for the active company management section
  const targetTenant = currentTenant || tenants[0] || null;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {isSystemAdmin ? 'aimutsu0120 管理者コンソール' : `${targetTenant?.name || '会社'} 管理コンソール`}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-900/80 text-indigo-300 border border-indigo-700">
                  {isSystemAdmin ? 'System Admin' : 'Company Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSystemAdmin
                  ? 'データベース稼働状況の監視、テナント（会社）およびアクセス許可メンバーの管理'
                  : `自社（${targetTenant?.name || ''}）にアクセスできる社員・メンバーのメールアドレス管理`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {targetTenant && (
              <div className="hidden md:flex flex-col items-end text-xs">
                <span className="text-slate-400 text-[10px]">現在の会社:</span>
                <span className="font-bold text-indigo-300">{targetTenant.name}</span>
              </div>
            )}
            <button
              id="btn-admin-enter-workspace"
              onClick={onEnterWorkspace}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <span>ワークスペースを開く</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {successMsg && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-6 py-6 space-y-6">

        {/* Section: Company Member Access Management (For Company Admins & System Admin) */}
        {targetTenant && (
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-700/80 flex items-center justify-center text-indigo-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>【{targetTenant.name}】アクセス許可メンバー管理</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                      責任者: {targetTenant.adminEmail}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    この会社にGoogleアカウントでアクセスできる社員・関係者のメールアドレスを追加・管理します
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                登録メンバー数: <span className="font-bold text-white">{(targetTenant.allowedEmails?.length || 0) + 1}</span> 名
              </div>
            </div>

            {/* Add Member Form */}
            {isCurrentTenantAdmin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddMemberEmail(targetTenant, newMemberEmail);
                }}
                className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800"
              >
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="アクセスを許可するメールアドレスを入力 (例: tanaka@example.com)"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  id="btn-add-tenant-member-email"
                  disabled={isSubmitting || !newMemberEmail.trim()}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>メンバーを追加</span>
                </button>
              </form>
            )}

            {/* Allowed Members List */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                アクセス権限を保持するアカウント一覧
              </div>

              {/* Primary Admin Row */}
              <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-950 border border-indigo-900/60 text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                    👑
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-white">{targetTenant.adminEmail}</span>
                    <span className="ml-2 text-[10px] text-indigo-400 font-bold px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800">
                      企業責任者 (Admin)
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> フル権限
                </span>
              </div>

              {/* Allowed Members Rows */}
              {targetTenant.allowedEmails && targetTenant.allowedEmails.length > 0 ? (
                targetTenant.allowedEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        👤
                      </div>
                      <span className="font-mono text-slate-200">{email}</span>
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                        一般メンバー
                      </span>
                    </div>

                    {isCurrentTenantAdmin && (
                      <button
                        onClick={() => handleRemoveMemberEmail(targetTenant, email)}
                        title="アクセス権限を解除"
                        className="p-1 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  追加されたメンバーはいません。上のフォームから社員のメールアドレスを追加してください。
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: System Admin Database Status (Firestore) */}
        {isSystemAdmin && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">Firestore データベース稼働状況</h2>
                  <p className="text-[11px] text-slate-400">リアルタイム同期中のコレクション実データ件数</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{dbStats.isFirestoreConnected ? 'Online (Connected)' : 'Connecting...'}</span>
                </div>
              </div>
            </div>

            {/* Database Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>テナント数</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.tenantsCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/tenants</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>ユーザー</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.usersCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/users</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>メッセージ</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.messagesCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/messages</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>タスク</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.tasksCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/tasks</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <Video className="w-3.5 h-3.5 text-purple-400" />
                  <span>会議</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.meetingsCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/meetings</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>暗号化ファイル</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.filesCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/files</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>監査ログ</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{dbStats.auditLogsCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">/auditLogs</div>
              </div>
            </div>
          </div>
        )}

        {/* Section: Firebase Hosting Operations */}
        {isSystemAdmin && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <Globe className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">Firebase Hosting 運用・配信ステータス</h2>
                  <p className="text-[11px] text-slate-400">
                    本番公開用ホスティングURLおよびデプロイ設定
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Hosting Ready (SPA configured)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Primary Domain (.web.app)
                  </div>
                  <a
                    href="https://waseapp-works-waseworkapp.web.app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                  >
                    <span>https://waseapp-works-waseworkapp.web.app</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  onClick={() => copyToClipboard('https://waseapp-works-waseworkapp.web.app', 'url1')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition"
                  title="URLをコピー"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCommand === 'url1' ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Secondary Domain (.firebaseapp.com)
                  </div>
                  <a
                    href="https://waseapp-works-waseworkapp.firebaseapp.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                  >
                    <span>https://waseapp-works-waseworkapp.firebaseapp.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard('https://waseapp-works-waseworkapp.firebaseapp.com', 'url2')
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition"
                  title="URLをコピー"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCommand === 'url2' ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-300 font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Firebase Hosting デプロイコマンド</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">firebase.json & .firebaserc 設定済</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
                <code className="text-[11px] font-mono text-emerald-300 select-all">
                  npm run build && firebase deploy --only hosting
                </code>
                <button
                  onClick={() =>
                    copyToClipboard('npm run build && firebase deploy --only hosting', 'cmd')
                  }
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1 self-start sm:self-auto transition shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCommand === 'cmd' ? 'コピー完了' : 'コマンドをコピー'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section: All Tenants List (System Admin or Multi-tenant view) */}
        {isSystemAdmin && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
              <div className="flex items-center space-x-2.5">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">全テナント（会社）一覧 & 会社追加</h2>
                  <p className="text-[11px] text-slate-400">
                    登録された企業テナントの一覧と新規会社追加
                  </p>
                </div>
              </div>

              <button
                id="btn-admin-add-tenant"
                onClick={() => {
                  setErrorMsg(null);
                  setIsCreateModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>会社テナント追加</span>
              </button>
            </div>

            {/* Tenant Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">テナント名 (会社名)</th>
                    <th className="py-2.5 px-3">管理者メールアドレス</th>
                    <th className="py-2.5 px-3">許可メンバー数</th>
                    <th className="py-2.5 px-3">登録日時</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenants.map((tenant) => {
                    const isSelected = currentTenant?.id === tenant.id;
                    const membersCount = (tenant.allowedEmails?.length || 0) + 1;
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-semibold text-white flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{tenant.name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700 font-normal">
                              選択中
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                          {tenant.adminEmail}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setSelectedTenantForMembers(tenant)}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition"
                          >
                            <Users className="w-3 h-3 text-indigo-400" />
                            <span>{membersCount} 名 (管理)</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {tenant.createdAt
                            ? new Date(tenant.createdAt).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '初期登録'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              id={`btn-select-tenant-${tenant.id}`}
                              onClick={() => {
                                onSelectTenant(tenant);
                                onEnterWorkspace();
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                isSelected
                                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {isSelected ? 'ワークスペースへ' : 'この会社に入る'}
                            </button>

                            {tenant.id !== 'waseapp-primary' && (
                              <button
                                id={`btn-delete-tenant-${tenant.id}`}
                                onClick={() => handleDelete(tenant)}
                                title="テナントを削除"
                                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Live System Audit Logs */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">最新セキュリティ & システム監査ログ</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              全 {auditLogs.length} 件
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {auditLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs font-mono"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('ja-JP')}
                  </span>
                  <span className="text-slate-300 font-medium truncate">{log.action}</span>
                  <span className="text-slate-500 text-[11px] truncate hidden sm:inline">
                    {log.detail}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0 ml-2">
                  {log.category}
                </span>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <p className="text-xs text-slate-500 py-3 text-center">監査ログはありません。</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Tenant */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">新規テナント（会社）の追加</h3>
                <p className="text-[11px] text-slate-400">テナント名と責任者メールアドレスを登録します</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  テナント名 (会社名) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 株式会社サンプル"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  企業責任者メールアドレス <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="例: ceo@sample.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ※このメールアドレスを持つアカウントが会社管理コンソールからメンバー追加を行えます。
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  id="btn-submit-create-tenant"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? '登録中...' : '会社を追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Tenant Members for selected tenant */}
      {selectedTenantForMembers && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedTenantForMembers(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  【{selectedTenantForMembers.name}】アクセス許可メンバー管理
                </h3>
                <p className="text-[11px] text-slate-400">
                  責任者: {selectedTenantForMembers.adminEmail}
                </p>
              </div>
            </div>

            {/* Quick add form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddMemberEmail(selectedTenantForMembers, newMemberEmail);
              }}
              className="mb-4 flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
            >
              <input
                type="email"
                required
                placeholder="追加するメールアドレスを入力"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newMemberEmail.trim()}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50 shrink-0"
              >
                追加
              </button>
            </form>

            {/* List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-950 border border-indigo-900/60 text-xs">
                <span className="font-mono text-white">{selectedTenantForMembers.adminEmail} (責任者)</span>
                <span className="text-[10px] text-emerald-400 font-mono">👑 管理者</span>
              </div>
              {selectedTenantForMembers.allowedEmails?.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <span className="font-mono text-slate-200">{email}</span>
                  <button
                    onClick={() => handleRemoveMemberEmail(selectedTenantForMembers, email)}
                    className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTenantForMembers(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
