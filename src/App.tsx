/**
 * WaseWorkApp - Microsoft Teams-style Enterprise Work & P2P Collaboration Platform
 * Features: End-to-End Encryption, WebRTC P2P Meetings, Task Management,
 * Real-Time Chat, and Zero-Knowledge File Sharing.
 */

import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { TopHeader } from './components/TopHeader';
import { ChatView } from './components/ChatView';
import { TaskBoardView } from './components/TaskBoardView';
import { MeetingView } from './components/MeetingView';
import { FilesVaultView } from './components/FilesVaultView';
import { SecurityVaultView } from './components/SecurityVaultView';
import { ActivityView } from './components/ActivityView';
import { TeamsView } from './components/TeamsView';
import { CalendarView } from './components/CalendarView';
import { RoleMatrixModal } from './components/RoleMatrixModal';
import { CorporateAuthGate } from './components/CorporateAuthGate';
import { AdminConsole } from './components/AdminConsole';
import { ProfileEditModal } from './components/ProfileEditModal';
import { TenantSelectModal } from './components/TenantSelectModal';
import {
  Channel,
  Message,
  NavigationTab,
  SecureFile,
  Task,
  User,
  Tenant,
  AuditLog,
  TaskStatus,
  UserRole,
  ScheduledMeeting,
} from './types';
import { socketClient } from './lib/websocket';
import {
  decryptText,
  encryptBinaryFile,
  getCurrentKeyFingerprint,
  getActiveKey,
  encryptText,
} from './lib/crypto';
import {
  auth,
  db,
  ensureAuth,
  signInWithGoogle,
  signOutFirebase,
  testFirestoreConnection,
  saveUserProfileToFirestore,
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  saveMeetingToFirestore,
  deleteMeetingFromFirestore,
  saveFileToFirestore,
  deleteFileFromFirestore,
  saveAuditLogToFirestore,
  saveMessageToFirestore,
  saveTenantToFirestore,
  deleteTenantFromFirestore,
  saveChannelToFirestore,
  deleteChannelFromFirestore,
  handleFirestoreError,
  OperationType,
  clearAllFirestoreSeedData,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';

const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'general',
    name: '全社連絡・一般',
    description: '全社共通の連絡事項やアナウンス・日常チャット用チャンネル',
    category: 'general',
    isPrivate: false,
    unreadCount: 0,
  },
  {
    id: 'project-team',
    name: '業務連絡・タスク連携',
    description: '日々の業務進捗、タスク共有、ファイル連絡用チャンネル',
    category: 'project',
    isPrivate: false,
    unreadCount: 0,
  },
  {
    id: 'dev-team',
    name: '開発・エンジニアリング',
    description: '技術議論、不具合報告、リリース連絡用チャンネル',
    category: 'dev',
    isPrivate: false,
    unreadCount: 0,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome-msg-1',
    channelId: 'general',
    encryptedContent: '',
    decryptedContent: 'Waseapp Enterprise 暗号化チャットへようこそ。社内メンバーの安全なコラボレーションにご活用いただけます。',
    iv: '',
    senderId: 'sys-admin',
    senderName: 'システム管理者 (WaseWork)',
    senderAvatar: 'WW',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    isEncrypted: false,
  },
  {
    id: 'welcome-msg-2',
    channelId: 'general',
    encryptedContent: '',
    decryptedContent: 'iPad・タブレットのタッチ操作に完全対応しました。画面全体の不要なスクロールを防ぎ、いつでも快適に入力・送信いただけます。',
    iv: '',
    senderId: 'sys-security',
    senderName: 'セキュリティ統括',
    senderAvatar: 'ST',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    isEncrypted: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsersCount, setConnectedUsersCount] = useState(1);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [meetingRoomId, setMeetingRoomId] = useState('WASE-MAIN');
  const [keyFingerprint, setKeyFingerprint] = useState(getCurrentKeyFingerprint());

  // Firebase Auth & Cloud State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);

  // Corporate Access Authentication Gate State
  const [isCompanyAuthenticated, setIsCompanyAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('wase_company_authenticated') === 'true';
  });

  // Current User
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('wase_corporate_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email) return parsed;
      }
    } catch (e) {}
    return {
      id: socketClient.userId,
      name: '管理者',
      avatar: 'AD',
      role: 'admin',
      roleTitle: 'システム管理者',
      status: 'online',
      companyName: '株式会社Waseapp',
      email: 'aimutsu0120@gmail.com',
      isSystemAdmin: true,
    };
  });

  // Tenants State (Source of Truth)
  const [tenants, setTenants] = useState<Tenant[]>([
    {
      id: 'waseapp-primary',
      name: '株式会社Waseapp',
      adminEmail: 'aimutsu0120@gmail.com',
      createdAt: '2026-09-01T00:00:00.000Z',
      createdBy: 'aimutsu0120@gmail.com',
    },
  ]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => ({
    id: 'waseapp-primary',
    name: '株式会社Waseapp',
    adminEmail: 'aimutsu0120@gmail.com',
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'aimutsu0120@gmail.com',
  }));

  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTenantSelectModalOpen, setIsTenantSelectModalOpen] = useState(false);

  // Channels - Initialized with default channels so chat is always active and usable
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');

  // Messages, Tasks, Files, Logs, Meetings
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);

  // Task Creation Modal Trigger from other views
  const [prefilledTaskText, setPrefilledTaskText] = useState<string | null>(null);

  // Role Switcher Handler
  const handleChangeRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setCurrentUser((prev) => ({
      ...prev,
      role: newRole,
    }));
    handleAddAuditLog({
      action: 'RBAC_ROLE_SWITCHED',
      detail: `ユーザーロールを変更: ${newRole.toUpperCase()} (権限マトリクスを即時反映)`,
      category: 'rbac',
      status: 'info',
    });
  };

  // Decrypt an incoming message
  const decryptSingleMessage = async (msg: Message): Promise<Message> => {
    if (msg.decryptedContent) return msg;
    if (msg.isEncrypted && msg.encryptedContent && msg.iv) {
      try {
        const decrypted = await decryptText(msg.encryptedContent, msg.iv);
        return { ...msg, decryptedContent: decrypted };
      } catch (e) {
        return { ...msg, decryptedContent: msg.encryptedContent };
      }
    }
    return { ...msg, decryptedContent: msg.encryptedContent };
  };

  const decryptSingleTask = async (task: any): Promise<Task> => {
    if (task.titleIv && task.title) {
      try {
        const decTitle = await decryptText(task.title, task.titleIv);
        let decDesc = task.description || '';
        if (task.descIv && task.description) {
          decDesc = await decryptText(task.description, task.descIv);
        }
        return { ...task, title: decTitle, description: decDesc };
      } catch (e) {
        return task;
      }
    }
    return task;
  };

  const decryptSingleMeeting = async (meeting: any): Promise<ScheduledMeeting> => {
    if (meeting.titleIv && meeting.title) {
      try {
        const decTitle = await decryptText(meeting.title, meeting.titleIv);
        let decDesc = meeting.description || '';
        if (meeting.descIv && meeting.description) {
          decDesc = await decryptText(meeting.description, meeting.descIv);
        }
        return { ...meeting, title: decTitle, description: decDesc };
      } catch (e) {
        return meeting;
      }
    }
    return meeting;
  };

  // Initial Setup
  useEffect(() => {

    // Listen for WebSocket Events
    const unsubConn = socketClient.on('connection:change', (data: { connected: boolean }) => {
      setIsConnected(data.connected);
    });

    const unsubInit = socketClient.on('init:state', async (payload: any) => {
      if (payload.tasks) setTasks(payload.tasks);
      if (payload.files) setFiles(payload.files);
      if (payload.auditLogs) setAuditLogs(payload.auditLogs);
      if (payload.meetings) setMeetings(payload.meetings);
      if (payload.connectedUsersCount) setConnectedUsersCount(payload.connectedUsersCount);

      if (payload.messages) {
        const decryptedList = await Promise.all(
          payload.messages.map((m: Message) => decryptSingleMessage(m))
        );
        setMessages(decryptedList);
      }
    });

    const unsubMsg = socketClient.on('chat:message', async (newMsg: Message) => {
      const decrypted = await decryptSingleMessage(newMsg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === decrypted.id)) return prev;
        return [...prev, decrypted];
      });
    });

    const unsubMeetingScheduled = socketClient.on('meeting:scheduled', (newMeeting: ScheduledMeeting) => {
      setMeetings((prev) => {
        if (prev.some((m) => m.id === newMeeting.id)) return prev;
        return [newMeeting, ...prev];
      });
    });

    const unsubMeetingDeleted = socketClient.on('meeting:deleted', (data: { id: string }) => {
      setMeetings((prev) => prev.filter((m) => m.id !== data.id));
    });

    const unsubRbacError = socketClient.on('error:rbac', (data: { message: string }) => {
      handleAddAuditLog({
        action: 'RBAC_SECURITY_INTERCEPT',
        detail: data.message,
        category: 'rbac',
        status: 'warning',
      });
    });

    const unsubTaskCreate = socketClient.on('task:created', (newTask: Task) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        return [newTask, ...prev];
      });
    });

    const unsubTaskUpdate = socketClient.on('task:updated', (updated: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    });

    const unsubTaskDelete = socketClient.on('task:deleted', (data: { id: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== data.id));
    });

    const unsubFileUploaded = socketClient.on('file:uploaded', (newFile: SecureFile) => {
      setFiles((prev) => {
        if (prev.some((f) => f.id === newFile.id)) return prev;
        return [newFile, ...prev];
      });
    });

    const unsubFileDeleted = socketClient.on('file:deleted', (data: { id: string }) => {
      setFiles((prev) => prev.filter((f) => f.id !== data.id));
    });

    const unsubAudit = socketClient.on('audit:new', (log: AuditLog) => {
      setAuditLogs((prev) => [log, ...prev]);
    });

    const unsubTasksUpdate = socketClient.on('tasks:update', (newTasks: Task[]) => {
      setTasks(newTasks);
    });

    const unsubMeetingsUpdate = socketClient.on('meetings:update', (newMeetings: ScheduledMeeting[]) => {
      setMeetings(newMeetings);
    });

    const unsubFilesUpdate = socketClient.on('files:update', (newFiles: SecureFile[]) => {
      setFiles(newFiles);
    });

    const unsubMessagesClear = socketClient.on('messages:clear', () => {
      setMessages([]);
    });

    const unsubPresence = socketClient.on('presence:update', (data: { activeUsersCount: number }) => {
      if (data.activeUsersCount) setConnectedUsersCount(data.activeUsersCount);
    });

    return () => {
      unsubConn();
      unsubInit();
      unsubMsg();
      unsubMeetingScheduled();
      unsubMeetingDeleted();
      unsubRbacError();
      unsubTaskCreate();
      unsubTaskUpdate();
      unsubTaskDelete();
      unsubFileUploaded();
      unsubFileDeleted();
      unsubAudit();
      unsubTasksUpdate();
      unsubMeetingsUpdate();
      unsubFilesUpdate();
      unsubMessagesClear();
      unsubPresence();
    };
  }, []);

  // Firebase Boot & Auth State Listener
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsFirestoreConnected(connected);
    });

    ensureAuth();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const isDefaultAdmin = fbUser.email === 'aimutsu0120@gmail.com';
        const role: UserRole = isDefaultAdmin ? 'admin' : (currentRole || 'member');
        const userRecord: User = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google 認証ユーザー',
          avatar: fbUser.displayName ? fbUser.displayName.slice(0, 2).toUpperCase() : 'FB',
          role,
          roleTitle: isDefaultAdmin ? '最高情報セキュリティ責任者 (Firebase Admin)' : 'プロジェクトメンバー',
          status: 'online',
        };
        setCurrentUser(userRecord);
        setCurrentRole(role);
        saveUserProfileToFirestore(userRecord, fbUser.email);

        handleAddAuditLog({
          action: 'FIREBASE_AUTH_SYNC',
          detail: `Firebase認証セッション確立: ${fbUser.email || fbUser.uid}`,
          category: 'rbac',
          status: 'success',
        });
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Firebase Firestore Realtime Sync when Authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    // 1. Sync Tasks
    const pathTasks = 'tasks';
    const unsubTasks = onSnapshot(
      collectionGroup(db, pathTasks),
      async (snapshot) => {
        const firestoreTasks: Task[] = [];
        const seenIds = new Set<string>();
        for (const d of snapshot.docs) {
          const raw = d.data();
          if (!raw.id.startsWith('task-') && !seenIds.has(raw.id)) {
            seenIds.add(raw.id);
            const dec = await decryptSingleTask(raw);
            firestoreTasks.push(dec);
          } else if (raw.id.startsWith('task-')) {
            deleteTaskFromFirestore(raw.id);
          }
        }
        if (firestoreTasks.length > 0) {
          setTasks(firestoreTasks);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathTasks);
      }
    );

    // 2. Sync Meetings
    const pathMeetings = 'meetings';
    const unsubMeetings = onSnapshot(
      collectionGroup(db, pathMeetings),
      async (snapshot) => {
        const firestoreMeetings: ScheduledMeeting[] = [];
        const seenIds = new Set<string>();
        for (const d of snapshot.docs) {
          const raw = d.data();
          if (!raw.id.startsWith('meet-') && !seenIds.has(raw.id)) {
            seenIds.add(raw.id);
            const dec = await decryptSingleMeeting(raw);
            firestoreMeetings.push(dec);
          } else if (raw.id.startsWith('meet-')) {
            deleteMeetingFromFirestore(raw.id);
          }
        }
        if (firestoreMeetings.length > 0) {
          setMeetings(firestoreMeetings);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathMeetings);
      }
    );

    // 3. Sync Files
    const pathFiles = 'files';
    const unsubFiles = onSnapshot(
      collectionGroup(db, pathFiles),
      (snapshot) => {
        const firestoreFiles: SecureFile[] = [];
        const seenIds = new Set<string>();
        snapshot.forEach((d) => {
          const f = d.data() as SecureFile;
          if (!f.id.startsWith('file-') && !seenIds.has(f.id)) {
            seenIds.add(f.id);
            firestoreFiles.push(f);
          } else if (f.id.startsWith('file-')) {
            deleteFileFromFirestore(f.id);
          }
        });
        if (firestoreFiles.length > 0) {
          setFiles(firestoreFiles);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathFiles);
      }
    );

    // 4. Sync Messages
    const pathMessages = 'messages';
    const unsubMessages = onSnapshot(
      collectionGroup(db, pathMessages),
      async (snapshot) => {
        const firestoreMessages: Message[] = [];
        const seenIds = new Set<string>();
        for (const d of snapshot.docs) {
          const m = d.data() as Message;
          if (!m.id.startsWith('seed-msg-') && !seenIds.has(m.id)) {
            seenIds.add(m.id);
            const decrypted = await decryptSingleMessage(m);
            firestoreMessages.push(decrypted);
          }
        }
        if (firestoreMessages.length > 0) {
          firestoreMessages.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
          setMessages(firestoreMessages);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathMessages);
      }
    );

    // 5. Sync Tenants
    const pathTenants = 'tenants';
    const unsubTenants = onSnapshot(
      collection(db, pathTenants),
      (snapshot) => {
        const firestoreTenants: Tenant[] = [];
        snapshot.forEach((d) => {
          firestoreTenants.push(d.data() as Tenant);
        });
        if (firestoreTenants.length > 0) {
          setTenants(firestoreTenants);
          setCurrentTenant((prev) => {
            if (!prev) return firestoreTenants[0];
            const found = firestoreTenants.find((t) => t.id === prev.id);
            return found || firestoreTenants[0];
          });
        }
      },
      (error) => {
        console.warn('Tenants sync notice:', error);
      }
    );

    // 6. Sync Channels
    const pathChannels = 'channels';
    const unsubChannels = onSnapshot(
      collectionGroup(db, pathChannels),
      (snapshot) => {
        const firestoreChannels: Channel[] = [];
        const seenIds = new Set<string>();
        snapshot.forEach((d) => {
          const c = d.data() as Channel;
          if (!seenIds.has(c.id)) {
            seenIds.add(c.id);
            firestoreChannels.push(c);
          }
        });
        if (firestoreChannels.length > 0) {
          setChannels(firestoreChannels);
          setActiveChannelId((prev) => prev || firestoreChannels[0].id);
        }
      },
      (error) => {
        console.warn('Channels sync notice:', error);
      }
    );

    return () => {
      unsubTasks();
      unsubMeetings();
      unsubFiles();
      unsubMessages();
      unsubTenants();
      unsubChannels();
    };
  }, [firebaseUser]);

  // Tenant Operations
  const handleCreateTenant = async (name: string, adminEmail: string) => {
    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name,
      adminEmail,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email || 'aimutsu0120@gmail.com',
    };
    setTenants((prev) => [...prev, newTenant]);
    if (firebaseUser) {
      await saveTenantToFirestore(newTenant);
    }
    handleAddAuditLog({
      action: 'TENANT_CREATED',
      detail: `新規テナント作成: ${name} (管理者: ${adminEmail})`,
      category: 'rbac',
      status: 'success',
    });
  };

  const handleDeleteTenant = async (tenantId: string) => {
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    if (firebaseUser) {
      await deleteTenantFromFirestore(tenantId);
    }
    if (currentTenant?.id === tenantId) {
      setCurrentTenant(tenants.find((t) => t.id !== tenantId) || null);
    }
    handleAddAuditLog({
      action: 'TENANT_DELETED',
      detail: `テナント削除: ${tenantId}`,
      category: 'rbac',
      status: 'warning',
    });
  };

  const handleUpdateTenantAllowedEmails = async (tenantId: string, allowedEmails: string[]) => {
    let targetUpdated: Tenant | null = null;
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === tenantId) {
          targetUpdated = { ...t, allowedEmails };
          return targetUpdated;
        }
        return t;
      })
    );
    if (currentTenant?.id === tenantId && targetUpdated) {
      setCurrentTenant(targetUpdated);
    }
    if (targetUpdated) {
      await saveTenantToFirestore(targetUpdated);
    }
    handleAddAuditLog({
      action: 'TENANT_MEMBERS_UPDATED',
      detail: `テナント [${tenantId}] のアクセス許可メンバー更新 (${allowedEmails.length} 名)`,
      category: 'rbac',
      status: 'success',
    });
  };

  // Switch Active Tenant
  const handleSelectTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    const userEmail = currentUser.email?.toLowerCase() || '';
    const isSysAdmin = userEmail === 'aimutsu0120@gmail.com' || currentUser.isSystemAdmin;
    const isTenantBoss = tenant.adminEmail?.toLowerCase() === userEmail;
    const assignedRole: UserRole = isSysAdmin || isTenantBoss ? 'admin' : 'member';

    const updatedUser: User = {
      ...currentUser,
      companyName: tenant.name,
      role: assignedRole,
      roleTitle: isSysAdmin
        ? 'システム全体管理者'
        : isTenantBoss
        ? '企業責任者 (Admin)'
        : '社内メンバー',
    };

    setCurrentUser(updatedUser);
    setCurrentRole(assignedRole);

    try {
      localStorage.setItem('wase_corporate_user', JSON.stringify(updatedUser));
    } catch (e) {}

    handleAddAuditLog({
      action: 'TENANT_SWITCHED',
      detail: `ワークスペースを [${tenant.name}] に切り替えました (権限: ${assignedRole})`,
      category: 'rbac',
      status: 'info',
    });
  };

  // Save / Update User Profile
  const handleSaveProfile = async (updatedFields: Partial<User>) => {
    const updatedUser: User = {
      ...currentUser,
      ...updatedFields,
    };
    setCurrentUser(updatedUser);

    try {
      localStorage.setItem('wase_corporate_user', JSON.stringify(updatedUser));
    } catch (e) {}

    await saveUserProfileToFirestore({
      ...updatedFields,
      id: currentUser.id,
    }, updatedUser.email);

    handleAddAuditLog({
      action: 'USER_PROFILE_UPDATED',
      detail: `プロフィールを更新しました: [${updatedUser.name}] (${updatedUser.roleTitle || updatedUser.role})`,
      category: 'rbac',
      status: 'info',
    });
  };

  // Handler to clear all data completely
  const handleClearAllData = async () => {
    const confirmed = window.confirm('初期データおよび現在のすべてのタスク、ミーティング、チャット、ファイルを完全に消去しますか？');
    if (!confirmed) return;

    try {
      // 1. Clear Firestore collections if connected
      await clearAllFirestoreSeedData();

      // 2. Clear local states
      setTasks([]);
      setMeetings([]);
      setFiles([]);
      setMessages([]);
      setAuditLogs([]);

      // 4. Record new clean audit log
      handleAddAuditLog({
        action: 'ALL_DATA_CLEARED',
        detail: '管理操作により初期データおよび全ストレージデータが完全に消去されました',
        category: 'auth',
        status: 'info',
      });
    } catch (e) {
      console.error('Failed to clear all data:', e);
    }
  };

  // Google Login and Signout handlers
  const handleSignInGoogle = async () => {
    try {
      const user = await signInWithGoogle();
      handleAddAuditLog({
        action: 'FIREBASE_AUTH_SUCCESS',
        detail: `Firebase Google 認証完了: ${user.email}`,
        category: 'rbac',
        status: 'success',
      });
    } catch (e) {
      console.error('Sign in failed:', e);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutFirebase();
      setFirebaseUser(null);
      handleAddAuditLog({
        action: 'FIREBASE_AUTH_LOGOUT',
        detail: 'Firebase セッションからログアウトしました',
        category: 'rbac',
        status: 'info',
      });
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  // Send Chat Message with optimistic local state update
  const handleSendMessage = async (msgPayload: {
    channelId: string;
    encryptedContent: string;
    iv: string;
    attachmentId?: string;
    attachmentName?: string;
  }) => {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    let decryptedText = '';
    try {
      decryptedText = await decryptText(msgPayload.encryptedContent, msgPayload.iv);
    } catch {
      decryptedText = msgPayload.encryptedContent;
    }

    const newMsg: Message = {
      id: msgId,
      channelId: msgPayload.channelId,
      encryptedContent: msgPayload.encryptedContent,
      decryptedContent: decryptedText,
      iv: msgPayload.iv,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: new Date().toISOString(),
      isEncrypted: true,
      attachmentId: msgPayload.attachmentId,
      attachmentName: msgPayload.attachmentName,
    };

    // 1. Optimistically append message so chat is instantaneous and never fails to show
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    // 2. Broadcast via WebSocket if connected
    socketClient.send('chat:send', {
      ...msgPayload,
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      userRole: currentUser.role,
    });

    // 3. Persist to Firestore
    if (firebaseUser) {
      saveMessageToFirestore(newMsg);
    }
  };

  // Create Task
  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const created: Task = {
        ...taskData,
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [created, ...prev]);
      await saveTaskToFirestore(created, currentTenant?.id || 'waseapp-primary');

      // Record audit log
      handleAddAuditLog({
        action: 'TASK_REGISTERED',
        detail: `新規タスク作成: [${created.title}] (優先度: ${created.priority})`,
        category: 'auth',
        status: 'verified',
      });
    } catch (e) {
      console.error('Failed to create task:', e);
    }
  };

  // Create Task from Calendar
  const handleCreateTaskWithDeadline = async (
    title: string,
    dueDate: string,
    priority: Task['priority']
  ) => {
    await handleCreateTask({
      title,
      description: `カレンダー経由で登録された締め切りタスク`,
      status: 'todo',
      priority,
      assignee: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
      },
      dueDate,
      channelId: 'general',
    });
  };

  // Schedule Meeting
  const handleScheduleMeeting = async (
    meetingData: Omit<ScheduledMeeting, 'id' | 'createdAt'>
  ) => {
    try {
      const created: ScheduledMeeting = {
        ...meetingData,
        id: `mtg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        hostId: currentUser.id,
        hostName: currentUser.name,
        hostAvatar: currentUser.avatar,
      };
      setMeetings((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [created, ...prev];
      });
      await saveMeetingToFirestore(created, currentTenant?.id || 'waseapp-primary');
    } catch (e) {
      console.error('Failed to schedule meeting:', e);
    }
  };

  // Delete Meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      await deleteMeetingFromFirestore(meetingId, currentTenant?.id || 'waseapp-primary');
    } catch (e) {
      console.error('Failed to delete meeting:', e);
    }
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const updated = { ...t, status: newStatus };
            saveTaskToFirestore(updated, currentTenant?.id || 'waseapp-primary');
            return updated;
          }
          return t;
        })
      );
    } catch (e) {
      console.error('Failed to update task:', e);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    try {
      if (currentUser.role !== 'admin') {
        alert('タスクの削除には管理者権限が必要です');
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await deleteTaskFromFirestore(taskId, currentTenant?.id || 'waseapp-primary');
    } catch (e) {
      console.error('Failed to delete task:', e);
    }
  };

  // Upload Client-Encrypted File
  const handleUploadFile = async (file: File): Promise<{ id: string; name: string }> => {
    const arrayBuffer = await file.arrayBuffer();
    const { encryptedData, iv, checksum } = await encryptBinaryFile(arrayBuffer);

    const newFile: SecureFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      iv,
      checksum,
      encryptedData,
      uploadedBy: currentUser.name,
      uploadedAt: new Date().toISOString(),
      channelId: activeChannelId,
    };

    setFiles((prev) => [newFile, ...prev]);
    await saveFileToFirestore(newFile, currentTenant?.id || 'waseapp-primary');

    return { id: newFile.id, name: newFile.name };
  };

  // Delete File
  const handleDeleteFile = async (fileId: string) => {
    try {
      if (currentUser.role !== 'admin') {
        alert('ファイルの削除には管理者権限が必要です');
        return;
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      await deleteFileFromFirestore(fileId, currentTenant?.id || 'waseapp-primary');
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  };

  // Share Task to Chat
  const handleShareTaskToChat = async (task: Task) => {
    try {
      const shareText = `📋 【タスク共有】「${task.title}」\n優先度: ${task.priority.toUpperCase()} | 期限: ${task.dueDate}\n詳細: ${task.description || '特記事項なし'}`;
      const { cipherText, iv } = await encryptText(shareText);
      handleSendMessage({
        channelId: activeChannelId,
        encryptedContent: cipherText,
        iv,
      });
      setActiveTab('chat');
    } catch (e) {
      console.error('Failed to share task:', e);
    }
  };

  // Share File to Chat
  const handleShareFileToChat = async (file: SecureFile) => {
    try {
      const shareText = `📁 【セキュアファイル共有】${file.name}\nファイルハッシュ(SHA-256): ${file.checksum.slice(0, 16)}...\nVaultよりダウンロード可能です。`;
      const { cipherText, iv } = await encryptText(shareText);
      handleSendMessage({
        channelId: activeChannelId,
        encryptedContent: cipherText,
        iv,
        attachmentId: file.id,
        attachmentName: file.name,
      });
      setActiveTab('chat');
    } catch (e) {
      console.error('Failed to share file:', e);
    }
  };

  // Create Task from Message
  const handleCreateTaskFromMessage = (messageText: string) => {
    setPrefilledTaskText(messageText);
    setActiveTab('tasks');
  };

  // Start Instant P2P Meeting
  const handleStartQuickMeeting = (roomName?: string) => {
    const code = roomName ? `WASE-${roomName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'MEET'}` : `WASE-MEET-${Math.floor(100 + Math.random() * 900)}`;
    setMeetingRoomId(code);
    setIsInMeeting(true);
    setCurrentUser((prev) => ({ ...prev, status: 'in_meeting' }));
    setActiveTab('meetings');
  };

  const handleAddAuditLog = (log: { action: string; detail: string; category: any; status: any }) => {
    const fullLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: log.action,
      detail: log.detail,
      category: log.category,
      status: log.status,
    };
    setAuditLogs((prev) => [fullLog, ...prev.slice(0, 49)]);
    saveAuditLogToFirestore(fullLog, currentTenant?.id || 'waseapp-primary').catch(console.error);
  };

  const handleKeyRotated = (newFingerprint: string) => {
    setKeyFingerprint(newFingerprint);
  };

  const handleCorporateAuthenticated = (user: User) => {
    const userEmail = user.email?.toLowerCase() || '';
    const isSysAdmin = userEmail === 'aimutsu0120@gmail.com' || user.isSystemAdmin;

    // Find accessible tenants
    const userTenants = isSysAdmin
      ? tenants
      : tenants.filter(
          (t) =>
            t.adminEmail?.toLowerCase() === userEmail ||
            (t.allowedEmails && t.allowedEmails.some((e) => e.toLowerCase() === userEmail))
        );

    // Default to the first matched tenant or primary
    const matchedTenant = userTenants.length > 0 ? userTenants[0] : (currentTenant || tenants[0]);

    const isTenantBoss = Boolean(matchedTenant && matchedTenant.adminEmail?.toLowerCase() === userEmail);
    const assignedRole: UserRole = isSysAdmin || isTenantBoss ? 'admin' : 'member';

    const updatedUser: User = {
      ...user,
      role: assignedRole,
      roleTitle: isSysAdmin
        ? 'システム全体管理者'
        : isTenantBoss
        ? '企業責任者 (Admin)'
        : '社内メンバー',
      companyName: matchedTenant ? matchedTenant.name : '株式会社Waseapp',
    };

    if (matchedTenant) {
      setCurrentTenant(matchedTenant);
    }
    setCurrentUser(updatedUser);
    setCurrentRole(assignedRole);
    setIsCompanyAuthenticated(true);

    // If user has multiple accessible tenants, automatically open tenant switcher for selection
    if (userTenants.length > 1) {
      setIsTenantSelectModalOpen(true);
    } else if (isSysAdmin || isTenantBoss) {
      setActiveTab('admin_console');
    }

    try {
      localStorage.setItem('wase_company_authenticated', 'true');
      localStorage.setItem('wase_corporate_user', JSON.stringify(updatedUser));
    } catch (e) {}

    handleAddAuditLog({
      action: 'CORP_GATEWAY_AUTH',
      detail: `社内アクセス認証成功: [${updatedUser.name}] (${updatedUser.roleTitle || updatedUser.role}) - 所属: ${updatedUser.companyName}`,
      category: 'auth',
      status: 'verified',
    });
  };

  const handleCorporateLogout = () => {
    setIsCompanyAuthenticated(false);
    try {
      localStorage.removeItem('wase_company_authenticated');
      localStorage.removeItem('wase_corporate_user');
    } catch (e) {}
    if (firebaseUser) {
      handleSignOutGoogle();
    }
  };

  const handleCreateChannel = (newChanData: {
    name: string;
    description: string;
    category: 'general' | 'dev' | 'project' | 'announcement';
    isPrivate: boolean;
  }) => {
    const newChan: Channel = {
      id: `chan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newChanData.name,
      description: newChanData.description,
      isPrivate: newChanData.isPrivate,
      category: newChanData.category,
      unreadCount: 0,
    };
    setChannels((prev) => [...prev, newChan]);
    setActiveChannelId(newChan.id);
    setActiveTab('chat');

    if (firebaseUser) {
      saveChannelToFirestore(newChan);
    }
  };

  // Start Direct Message session with a colleague
  const handleStartDM = (recipientName: string, roleTitle?: string, email?: string) => {
    const dmId = `dm-${Date.now()}`;
    const initials = recipientName.slice(0, 2).toUpperCase();
    const newDMChan: Channel = {
      id: dmId,
      name: recipientName,
      description: `1対1 E2EE暗号化ダイレクトメッセージ (${recipientName})`,
      isPrivate: true,
      category: 'direct',
      unreadCount: 0,
      dmPeer: {
        id: `peer-${Date.now()}`,
        name: recipientName,
        avatar: initials,
        email,
        roleTitle: roleTitle || '社内社員',
        status: 'online',
      },
    };
    setChannels((prev) => [...prev, newDMChan]);
    setActiveChannelId(dmId);
    setActiveTab('chat');

    handleAddAuditLog({
      action: 'DM_THREAD_CREATED',
      detail: `E2EE暗号化DMセッション開始: ${recipientName} (${roleTitle || '社内社員'})`,
      category: 'crypto',
      status: 'verified',
    });
  };

  // Delete or close a channel or DM thread
  const handleDeleteChannel = (channelId: string) => {
    setChannels((prev) => {
      const next = prev.filter((c) => c.id !== channelId);
      if (activeChannelId === channelId) {
        setActiveChannelId(next.length > 0 ? next[0].id : '');
      }
      return next;
    });
  };

  // If not corporate authenticated, gate the workspace completely
  if (!isCompanyAuthenticated) {
    return <CorporateAuthGate onAuthenticated={handleCorporateAuthenticated} />;
  }

  const userEmail = currentUser.email?.toLowerCase() || '';
  const isSysAdmin = userEmail === 'aimutsu0120@gmail.com' || currentUser.isSystemAdmin;

  const accessibleTenants = isSysAdmin
    ? tenants
    : tenants.filter(
        (t) =>
          t.adminEmail?.toLowerCase() === userEmail ||
          (t.allowedEmails && t.allowedEmails.some((e) => e.toLowerCase() === userEmail))
      );

  const isTenantAdmin = Boolean(
    currentUser.email?.toLowerCase() === 'aimutsu0120@gmail.com' ||
    currentUser.isSystemAdmin ||
    currentUser.role === 'admin' ||
    (currentTenant && currentUser.email?.toLowerCase() === currentTenant.adminEmail?.toLowerCase())
  );

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 font-sans antialiased text-slate-100 touch-manipulation pt-safe pb-safe flex select-none">
      {/* Left Vertical Teams Rail Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onStatusChange={(status) => setCurrentUser((prev) => ({ ...prev, status }))}
        unreadCount={channels.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
        unreadActivityCount={0}
        activeTasksCount={tasks.filter((t) => t.status !== 'done').length}
        isConnected={isConnected}
        isInMeeting={isInMeeting}
        isTenantAdmin={isTenantAdmin}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header with Firebase Integration */}
        <TopHeader
          onTabChange={setActiveTab}
          onOpenNewTaskModal={() => setActiveTab('tasks')}
          onStartQuickMeeting={() => handleStartQuickMeeting()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          keyFingerprint={keyFingerprint}
          connectedUsersCount={connectedUsersCount}
          currentRole={currentRole}
          onChangeRole={handleChangeRole}
          onOpenRoleMatrix={() => setIsRoleMatrixOpen(true)}
          firebaseUser={firebaseUser}
          onSignInGoogle={handleSignInGoogle}
          onSignOutGoogle={handleSignOutGoogle}
          isFirestoreConnected={isFirestoreConnected}
          onClearAllData={handleClearAllData}
          onCorporateLogout={handleCorporateLogout}
          currentUser={currentUser}
          currentTenantName={currentTenant?.name}
          isTenantAdmin={isTenantAdmin}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenTenantSelectModal={() => setIsTenantSelectModalOpen(true)}
          accessibleTenantsCount={accessibleTenants.length}
        />

        {/* Dynamic View Panels */}
        <div className="flex-1 flex overflow-hidden relative">
          {activeTab === 'admin_console' && (
            <AdminConsole
              currentUser={currentUser}
              tenants={tenants}
              currentTenant={currentTenant}
              onSelectTenant={(tenant) => {
                handleSelectTenant(tenant);
              }}
              onCreateTenant={handleCreateTenant}
              onDeleteTenant={handleDeleteTenant}
              onUpdateTenantAllowedEmails={handleUpdateTenantAllowedEmails}
              onEnterWorkspace={() => setActiveTab('chat')}
              dbStats={{
                isFirestoreConnected,
                tenantsCount: tenants.length,
                usersCount: connectedUsersCount,
                messagesCount: messages.length,
                tasksCount: tasks.length,
                meetingsCount: meetings.length,
                filesCount: files.length,
                auditLogsCount: auditLogs.length,
              }}
              auditLogs={auditLogs}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
              messages={messages}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onCreateTaskFromMessage={handleCreateTaskFromMessage}
              onStartMeetingInChannel={(name) => handleStartQuickMeeting(name)}
              onUploadEncryptedFile={handleUploadFile}
              onCreateChannel={handleCreateChannel}
              onStartDM={handleStartDM}
              onDeleteChannel={handleDeleteChannel}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              meetings={meetings}
              tasks={tasks}
              currentUser={currentUser}
              onJoinMeeting={(roomId) => {
                setMeetingRoomId(roomId);
                setIsInMeeting(true);
                setCurrentUser((prev) => ({ ...prev, status: 'in_meeting' }));
                setActiveTab('meetings');
              }}
              onScheduleMeeting={handleScheduleMeeting}
              onDeleteMeeting={handleDeleteMeeting}
              onCreateTaskWithDeadline={handleCreateTaskWithDeadline}
              onOpenTaskDetails={() => setActiveTab('tasks')}
            />
          )}

          {activeTab === 'tasks' && (
            <TaskBoardView
              tasks={tasks}
              currentUser={currentUser}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onDeleteTask={handleDeleteTask}
              onCreateTask={handleCreateTask}
              onShareTaskToChat={handleShareTaskToChat}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingView
              currentUser={currentUser}
              initialRoomId={meetingRoomId}
              onLeaveMeeting={() => {
                setIsInMeeting(false);
                setCurrentUser((prev) => ({ ...prev, status: 'online' }));
              }}
              onOpenSecurityAudit={() => setActiveTab('security')}
            />
          )}

          {activeTab === 'files' && (
            <FilesVaultView
              files={files}
              currentUser={currentUser}
              onUploadFile={handleUploadFile}
              onDeleteFile={handleDeleteFile}
              onShareToChat={handleShareFileToChat}
            />
          )}

          {activeTab === 'security' && (
            <SecurityVaultView
              auditLogs={auditLogs}
              keyFingerprint={keyFingerprint}
              onKeyRotated={handleKeyRotated}
              onAddAuditLog={handleAddAuditLog}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityView
              onNavigate={setActiveTab}
              tasks={tasks}
              auditLogs={auditLogs}
              unreadCount={channels.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
            />
          )}

          {activeTab === 'teams' && (
            <TeamsView
              channels={channels}
              currentUser={currentUser}
              onSelectChannel={(id) => {
                setActiveChannelId(id);
                setActiveTab('chat');
              }}
              onStartMeeting={(channelName) => handleStartQuickMeeting(channelName)}
              onCreateChannel={(name, desc) =>
                handleCreateChannel({
                  name,
                  description: desc,
                  category: 'general',
                  isPrivate: false,
                })
              }
            />
          )}
        </div>
      </div>

      {/* RBAC Role & Permissions Matrix Modal */}
      <RoleMatrixModal
        isOpen={isRoleMatrixOpen}
        onClose={() => setIsRoleMatrixOpen(false)}
        currentRole={currentRole}
        onSelectRole={handleChangeRole}
      />

      {/* Profile Edit Modal */}
      <ProfileEditModal
        currentUser={currentUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSaveProfile={handleSaveProfile}
      />

      {/* Tenant / Company Switcher Modal */}
      <TenantSelectModal
        isOpen={isTenantSelectModalOpen}
        onClose={() => setIsTenantSelectModalOpen(false)}
        tenants={tenants}
        currentTenant={currentTenant}
        currentUser={currentUser}
        onSelectTenant={handleSelectTenant}
      />
    </div>
  );
}
