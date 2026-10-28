import { UserRole, RolePermissions } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    // Task management: Full control
    canCreateTask: true,
    canEditTaskStatus: true,
    canEditTaskDetails: true,
    canDeleteTask: true,
    // Chat access: Full control
    canSendMessage: true,
    canCreateChannel: true,
    canAttachFiles: true,
    canDeleteMessage: true,
    // Meeting participation: Full control
    canScheduleMeeting: true,
    canStartInstantMeeting: true,
    canJoinMeeting: true,
    canShareScreen: true,
    canEndMeetingForEveryone: true,
    // File sharing: Full control
    canUploadFile: true,
    canDownloadFile: true,
    canDeleteFile: true,
    // Security & Administration
    canRotateMasterKey: true,
    canViewAuditLogs: true,
    canManageUserRoles: true,
  },
  member: {
    // Task management: Active collaboration
    canCreateTask: true,
    canEditTaskStatus: true,
    canEditTaskDetails: true,
    canDeleteTask: false, // Protected: Only Admins can permanently delete
    // Chat access: Active communication
    canSendMessage: true,
    canCreateChannel: false, // Standard members cannot create official channels
    canAttachFiles: true,
    canDeleteMessage: false,
    // Meeting participation
    canScheduleMeeting: true,
    canStartInstantMeeting: true,
    canJoinMeeting: true,
    canShareScreen: true,
    canEndMeetingForEveryone: false,
    // File sharing
    canUploadFile: true,
    canDownloadFile: true,
    canDeleteFile: false, // Protected
    // Security & Administration
    canRotateMasterKey: false, // Protected: Master key rotation reserved for Admins
    canViewAuditLogs: true,
    canManageUserRoles: false,
  },
  viewer: {
    // Task management: Read-only
    canCreateTask: false,
    canEditTaskStatus: false,
    canEditTaskDetails: false,
    canDeleteTask: false,
    // Chat access: Read-only
    canSendMessage: false,
    canCreateChannel: false,
    canAttachFiles: false,
    canDeleteMessage: false,
    // Meeting participation: Attendee only
    canScheduleMeeting: false,
    canStartInstantMeeting: false,
    canJoinMeeting: true,
    canShareScreen: false,
    canEndMeetingForEveryone: false,
    // File sharing: Read-only
    canUploadFile: false,
    canDownloadFile: true,
    canDeleteFile: false,
    // Security & Administration
    canRotateMasterKey: false,
    canViewAuditLogs: true, // Audit trail transparency
    canManageUserRoles: false,
  },
};

export interface RoleMetadata {
  role: UserRole;
  label: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  scopeSummary: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  admin: {
    role: 'admin',
    label: '管理者 (Administrator)',
    badgeLabel: 'ADMIN',
    badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800',
    description: 'システム全体および組織の最高権限。全機能の作成・編集・削除・暗号鍵のローテーションが可能。',
    scopeSummary: '全リソースの作成・変更・削除、チャンネル作成、暗号マスターキー再導出',
  },
  member: {
    role: 'member',
    label: 'チームメンバー (Team Member)',
    badgeLabel: 'MEMBER',
    badgeColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-800',
    description: '通常の業務参加者。タスク作成、チャット送信、P2P会議の開始・画面共有、ファイル共有が可能。',
    scopeSummary: 'タスク・チャット・会議・ファイル共有への通常参加（恒久削除や鍵更新は制限）',
  },
  viewer: {
    role: 'viewer',
    label: '閲覧者 (Viewer / Guest)',
    badgeLabel: 'VIEWER',
    badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800',
    description: '外部監査役・インターン・ゲスト向けの読み取り専用権限。チャットやタスクの閲覧、会議の傍聴が可能。',
    scopeSummary: '読み取り専用アクセス。メッセージ送信、タスク編集、ファイル投稿、画面共有は無効化',
  },
};

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  const roleRules = ROLE_PERMISSIONS[role];
  if (!roleRules) return false;
  return Boolean(roleRules[permission]);
}
