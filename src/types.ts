export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type UserRole = 'admin' | 'member' | 'viewer';

export interface RolePermissions {
  // Task management
  canCreateTask: boolean;
  canEditTaskStatus: boolean;
  canEditTaskDetails: boolean;
  canDeleteTask: boolean;
  // Chat access
  canSendMessage: boolean;
  canCreateChannel: boolean;
  canAttachFiles: boolean;
  canDeleteMessage: boolean;
  // Meeting participation
  canScheduleMeeting: boolean;
  canStartInstantMeeting: boolean;
  canJoinMeeting: boolean;
  canShareScreen: boolean;
  canEndMeetingForEveryone: boolean;
  // File sharing
  canUploadFile: boolean;
  canDownloadFile: boolean;
  canDeleteFile: boolean;
  // Security & Administration
  canRotateMasterKey: boolean;
  canViewAuditLogs: boolean;
  canManageUserRoles: boolean;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  photoURL?: string;
  role: UserRole;
  roleTitle?: string;
  status: 'online' | 'busy' | 'away' | 'in_meeting';
  companyName?: string;
  email?: string;
  isSystemAdmin?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  adminEmail: string;
  createdAt: string;
  createdBy: string;
  allowedEmails?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: {
    id: string;
    name: string;
    avatar: string;
  };
  dueDate: string;
  channelId?: string;
  createdBy?: string;
  createdAt: string;
  encryptedNotes?: string;
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  description: string;
  roomId: string;
  startTime: string; // ISO or "2026-09-21T15:00"
  endTime: string;   // ISO or "2026-09-21T16:00"
  date: string;      // YYYY-MM-DD
  hostId: string;
  hostName: string;
  hostAvatar: string;
  channelId?: string;
  participants: Array<{
    id: string;
    name: string;
    avatar: string;
    status: 'accepted' | 'tentative' | 'declined';
  }>;
  isEncrypted: boolean;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  unreadCount?: number;
  category: 'general' | 'project' | 'dev' | 'announcement' | 'direct';
  dmPeer?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
    roleTitle?: string;
    status: 'online' | 'busy' | 'away' | 'in_meeting';
  };
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  encryptedContent: string;
  decryptedContent?: string;
  iv: string;
  timestamp: string;
  isEncrypted: boolean;
  attachmentId?: string;
  attachmentName?: string;
}

export interface SecureFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  iv: string;
  checksum: string;
  encryptedData: string; // Base64 ciphertext
  uploadedBy: string;
  uploadedAt: string;
  channelId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  category: 'crypto' | 'p2p' | 'auth' | 'file' | 'rbac';
  status: 'verified' | 'info' | 'warning';
}

export interface PeerSession {
  peerId?: string;
  userId: string;
  userName: string;
  avatar?: string;
  stream?: MediaStream;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
  connectionState?: RTCIceConnectionState;
  rtcConnection?: RTCPeerConnection;
}

export type NavigationTab =
  | 'activity'
  | 'chat'
  | 'teams'
  | 'calendar'
  | 'tasks'
  | 'meetings'
  | 'files'
  | 'security'
  | 'admin_console';

