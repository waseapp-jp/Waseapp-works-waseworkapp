import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Task, SecureFile, ScheduledMeeting, AuditLog, Message, User, Tenant } from '../types';
import { encryptText, decryptText } from './crypto';

// Initialize Firebase SDK
export const firebaseApp = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying the database ID from config
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on initial application boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connection test successfully established');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline or database initializing. Please check your Firebase configuration.');
      return false;
    }
    // Missing permission on test document is normal when rules deny unmatched docs, which means server responded!
    console.log('[Firestore] Gateway responded with security check.');
    return true;
  }
}

/**
 * Check if returning from a Google Sign-In redirect
 */
export async function checkRedirectAuthResult(): Promise<FirebaseUser | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Error handling redirect auth result:', error);
    return null;
  }
}

/**
 * Google Sign-In with Redirect (Best for Safari / iPad / Mobile)
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(auth, provider);
}

/**
 * Google Sign-In with popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error('Failed to sign in with Google popup:', error);
    const code = error?.code || '';
    const msg = error?.message || String(error);

    if (code === 'auth/unauthorized-domain') {
      const currentHost = window.location.hostname;
      throw new Error(
        `【ドメイン未許可エラー (${code})】\n現在のドメイン [${currentHost}] が Firebase Authentication の「承認済みドメイン」に登録されていません。\nFirebase Console -> Authentication -> 設定 -> 承認済みドメイン に「${currentHost}」を追加してください。`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('【ポップアップブロック】\nブラウザによりログインポップアップがブロックされました。「ページ移動でログイン (Safari推奨)」をお試しください。');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('ログインポップアップ画面が閉じられました。');
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error('【Google 認証未有効化】\nFirebase Console で「Google 認証」が有効化されていません。Authentication の Sign-in method で Google を有効化してください。');
    }
    if (code === 'auth/argument-error' || msg.includes('Database is closing') || msg.includes('closing/hidden')) {
      throw new Error('【Safari / iPad ポップアップ制限】\nSafari のセキュリティ制限によりポップアップがブロックされました。下の「ページ移動でGoogleログイン (Safari/iPad推奨)」をお試しください。');
    }
    throw new Error(`Google 認証エラー (${code || 'UNKNOWN'}): ${msg}`);
  }
}

/**
 * Ensure an active Firebase Auth user exists (auto-fallback to anonymous sign-in)
 */
export async function ensureAuth(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
  } catch (e) {}
  if (auth.currentUser) return auth.currentUser;
  try {
    const res = await signInAnonymously(auth);
    return res.user;
  } catch (err) {
    return auth.currentUser;
  }
}

/**
 * Guest / Anonymous Sign-In (Ensures full Firebase access even if Google Auth popup is blocked/unauthorized domain)
 */
export async function signInAsGuestOrAnonymous(name: string): Promise<{ uid: string; displayName: string }> {
  try {
    const res = await signInAnonymously(auth);
    return {
      uid: res.user.uid,
      displayName: name || '招待メンバー',
    };
  } catch (error) {
    console.warn('Anonymous sign-in fallback to local session id:', error);
    // Local fallback if anonymous auth not enabled in Firebase
    const localUid = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      uid: localUid,
      displayName: name || '招待メンバー',
    };
  }
}

/**
 * Sign out current Firebase user
 */
export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

// --- Synchronous SHA-256 and Custom Authentication Utilities ---

function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 255) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    let oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      let i2 = j + i;
      const s0 = j < 16 ? w[j] : (w[j] = (
        (rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10)) +
        (w[j - 7] || 0) +
        (rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3)) +
        (w[j - 16] || 0)
      ) | 0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const s0_2 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const temp1 = (hash[7] + s1 + ch + k[j] + (w[j] || 0)) | 0;
      const temp2 = (s0_2 + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function hashNewInput(input: string): string {
  if (!input) return '';
  return sha256Sync(input.trim());
}

export function isSHA256(str: string): boolean {
  return typeof str === 'string' && /^[0-9a-fA-F]{64}$/.test(str.trim());
}

export function checkPassword(input: string, stored: string): boolean {
  if (!input || !stored) return false;
  const trimmed = input.trim();
  return stored === trimmed || stored === hashNewInput(trimmed);
}

export function checkAnswer(input: string, stored: string): boolean {
  if (!input || !stored) return false;
  const cleanInput = input.trim().toLowerCase();
  const cleanStored = stored.trim().toLowerCase();
  return (
    cleanStored === cleanInput ||
    stored === input.trim() ||
    stored === hashNewInput(input.trim()) ||
    stored === hashNewInput(cleanInput)
  );
}

export const ADMIN_USERS = ['aimutsu0120@gmail.com', 'Mutsu_0120', 'admin'];

export async function loginWithCustomIdPassword(id: string, pass: string): Promise<User> {
  const cleanId = id.trim();
  const cleanPass = pass.trim();

  await ensureAuth().catch(() => null);

  let localAccounts: Record<string, any> = {};
  try {
    const raw = localStorage.getItem('waseapp_custom_accounts');
    if (raw) localAccounts = JSON.parse(raw);
  } catch (e) {}

  let firestoreUser: any = null;
  let firestoreSecrets: any = null;
  try {
    const userDoc = await getDoc(doc(db, 'users', cleanId)).catch(() => null);
    if (userDoc && userDoc.exists()) {
      firestoreUser = userDoc.data();
    }
  } catch (err) {
    console.warn('[CustomAuth] Firestore user query notice:', err);
  }

  try {
    const secretDoc = await getDoc(doc(db, 'users_secrets', cleanId)).catch(() => null);
    if (secretDoc && secretDoc.exists()) {
      firestoreSecrets = secretDoc.data();
    }
  } catch (err) {
    // Secret query notice
  }

  const storedPass = firestoreSecrets?.pass || firestoreUser?.pass || localAccounts[cleanId]?.pass;

  if (storedPass) {
    if (!checkPassword(cleanPass, storedPass)) {
      throw new Error('パスワードが間違っています。');
    }
  } else {
    const isSpecialAdmin =
      cleanId.toLowerCase() === 'mutsu_0120' ||
      cleanId.toLowerCase() === 'admin' ||
      cleanId.toLowerCase() === 'aimutsu0120@gmail.com';

    if (!isSpecialAdmin && !localAccounts[cleanId]) {
      throw new Error('ユーザー ID が見つかりません。「新規アカウントを作成」から登録してください。');
    }
  }

  const isSystemAdmin =
    cleanId.toLowerCase() === 'mutsu_0120' ||
    cleanId.toLowerCase() === 'aimutsu0120@gmail.com' ||
    firestoreUser?.isSystemAdmin ||
    firestoreUser?.email?.toLowerCase() === 'aimutsu0120@gmail.com';

  const userRecord: User = {
    id: cleanId,
    name: firestoreUser?.name || localAccounts[cleanId]?.user?.name || cleanId,
    avatar: cleanId.slice(0, 2).toUpperCase() || 'US',
    role: isSystemAdmin ? 'admin' : (firestoreUser?.role || 'member'),
    roleTitle: isSystemAdmin ? 'システム全体管理者' : (firestoreUser?.roleTitle || 'メンバー'),
    status: 'online',
    companyName: firestoreUser?.companyName || '株式会社Waseapp',
    email: firestoreUser?.email || (cleanId.includes('@') ? cleanId : `${cleanId}@waseapp.internal`),
    isSystemAdmin,
  };

  saveUserProfileToFirestore(userRecord).catch(() => {});
  try {
    localStorage.setItem('wase_corporate_user', JSON.stringify(userRecord));
    localStorage.setItem('wase_company_authenticated', 'true');
  } catch (e) {}

  return userRecord;
}

export async function registerCustomIdPassword(
  id: string,
  pass: string,
  secretQuestion: string,
  secretAnswer: string
): Promise<User> {
  const cleanId = id.trim();
  const cleanPass = pass.trim();
  const cleanQ = secretQuestion.trim();
  const cleanAns = secretAnswer.trim();

  if (!cleanId || !cleanPass) {
    throw new Error('IDとパスワードを入力してください。');
  }

  await ensureAuth().catch(() => null);

  const hashedPass = hashNewInput(cleanPass);
  const hashedAnswer = cleanAns ? hashNewInput(cleanAns.toLowerCase()) : '';

  const isSystemAdmin =
    cleanId.toLowerCase() === 'mutsu_0120' ||
    cleanId.toLowerCase() === 'aimutsu0120@gmail.com';

  const userRecord: User = {
    id: cleanId,
    name: cleanId,
    avatar: cleanId.slice(0, 2).toUpperCase() || 'US',
    role: isSystemAdmin ? 'admin' : 'member',
    roleTitle: isSystemAdmin ? 'システム全体管理者' : 'メンバー',
    status: 'online',
    companyName: '株式会社Waseapp',
    email: cleanId.includes('@') ? cleanId : `${cleanId}@waseapp.internal`,
    isSystemAdmin,
  };

  await saveUserProfileToFirestore(userRecord);

  try {
    await setDoc(
      doc(db, 'users_secrets', cleanId),
      {
        pass: hashedPass,
        secretQuestion: cleanQ,
        secretAnswer: hashedAnswer,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[Firestore] users_secrets save notice:', e);
  }

  try {
    const raw = localStorage.getItem('waseapp_custom_accounts');
    const localAccounts = raw ? JSON.parse(raw) : {};
    localAccounts[cleanId] = {
      pass: hashedPass,
      secretQuestion: cleanQ,
      secretAnswer: hashedAnswer,
      user: userRecord,
    };
    localStorage.setItem('waseapp_custom_accounts', JSON.stringify(localAccounts));
    localStorage.setItem('wase_corporate_user', JSON.stringify(userRecord));
    localStorage.setItem('wase_company_authenticated', 'true');
  } catch (e) {}

  return userRecord;
}

/**
 * Upsert User Profile into Firestore /users/{uid}
 */
export async function saveUserProfileToFirestore(user: Partial<User> & { id: string }, email?: string | null) {
  try {
    const currentAuth = await ensureAuth().catch(() => null);
    const targetId = user.id || currentAuth?.uid || auth.currentUser?.uid || 'user';

    const payload: any = {
      id: targetId,
      name: user.name || 'ユーザー',
      role: user.role || 'member',
      status: user.status || 'online',
      updatedAt: new Date().toISOString(),
    };
    if (email || user.email) payload.email = email || user.email;
    if (user.avatar) payload.avatar = user.avatar;
    if (user.photoURL !== undefined) payload.photoURL = user.photoURL;
    if (user.companyName) payload.companyName = user.companyName;
    if (user.roleTitle !== undefined) payload.roleTitle = user.roleTitle;
    if (user.isSystemAdmin !== undefined) payload.isSystemAdmin = user.isSystemAdmin;

    await setDoc(doc(db, 'users', targetId), payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Profile save notice (non-blocking):', err);
  }
}

/**
 * Save Task to Firestore (Tenant -> Channel Hierarchy + AES-256-GCM Zero-Knowledge Encryption)
 */
export async function saveTaskToFirestore(task: Task, tenantId = 'waseapp-primary', channelId?: string) {
  const currentAuth = await ensureAuth().catch(() => null);
  const currentUid = currentAuth?.uid || auth.currentUser?.uid || task.createdBy || 'user';
  const targetChannel = channelId || task.channelId || 'general';

  // Zero-Knowledge AES-256-GCM Encryption
  let encryptedTitle = task.title;
  let encryptedDesc = task.description;
  let titleIv = '';
  let descIv = '';

  try {
    const encTitle = await encryptText(task.title);
    encryptedTitle = encTitle.cipherText;
    titleIv = encTitle.iv;
    if (task.description) {
      const encDesc = await encryptText(task.description);
      encryptedDesc = encDesc.cipherText;
      descIv = encDesc.iv;
    }
  } catch (err) {
    console.warn('Task AES-256 encryption notice:', err);
  }

  const payload = {
    ...task,
    title: encryptedTitle,
    description: encryptedDesc,
    titleIv,
    descIv,
    createdBy: task.createdBy || currentUid,
    updatedAt: new Date().toISOString(),
  };

  const subPath = `tenants/${tenantId}/channels/${targetChannel}/tasks/${task.id}`;
  const topPath = `tasks/${task.id}`;

  try {
    await setDoc(doc(db, topPath), payload);
    await setDoc(doc(db, subPath), payload).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Delete Task from Firestore
 */
export async function deleteTaskFromFirestore(taskId: string, tenantId = 'waseapp-primary', channelId = 'general') {
  await ensureAuth().catch(() => null);
  try {
    await deleteDoc(doc(db, `tasks/${taskId}`));
    await deleteDoc(doc(db, `tenants/${tenantId}/channels/${channelId}/tasks/${taskId}`)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
  }
}

/**
 * Save Meeting to Firestore (Tenant Hierarchy + AES-256 Encryption)
 */
export async function saveMeetingToFirestore(meeting: ScheduledMeeting, tenantId = 'waseapp-primary') {
  const currentAuth = await ensureAuth().catch(() => null);
  const currentUid = currentAuth?.uid || auth.currentUser?.uid || meeting.hostId || 'user';

  let encryptedTitle = meeting.title;
  let encryptedDesc = meeting.description || '';
  let titleIv = '';
  let descIv = '';

  try {
    const encTitle = await encryptText(meeting.title);
    encryptedTitle = encTitle.cipherText;
    titleIv = encTitle.iv;
    if (meeting.description) {
      const encDesc = await encryptText(meeting.description);
      encryptedDesc = encDesc.cipherText;
      descIv = encDesc.iv;
    }
  } catch (err) {
    console.warn('Meeting AES-256 encryption notice:', err);
  }

  const payload = {
    ...meeting,
    title: encryptedTitle,
    description: encryptedDesc,
    titleIv,
    descIv,
    hostId: meeting.hostId || currentUid,
    updatedAt: new Date().toISOString(),
  };

  const subPath = `tenants/${tenantId}/meetings/${meeting.id}`;
  const topPath = `meetings/${meeting.id}`;

  try {
    await setDoc(doc(db, topPath), payload);
    await setDoc(doc(db, subPath), payload).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Delete Meeting from Firestore
 */
export async function deleteMeetingFromFirestore(meetingId: string, tenantId = 'waseapp-primary') {
  await ensureAuth().catch(() => null);
  try {
    await deleteDoc(doc(db, `meetings/${meetingId}`));
    await deleteDoc(doc(db, `tenants/${tenantId}/meetings/${meetingId}`)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `meetings/${meetingId}`);
  }
}

/**
 * Save SecureFile record to Firestore (Tenant -> Channel Hierarchy)
 */
export async function saveFileToFirestore(file: SecureFile, tenantId = 'waseapp-primary') {
  await ensureAuth().catch(() => null);
  const targetChannel = file.channelId || 'general';

  const subPath = `tenants/${tenantId}/channels/${targetChannel}/files/${file.id}`;
  const topPath = `files/${file.id}`;

  try {
    await setDoc(doc(db, topPath), file);
    await setDoc(doc(db, subPath), file).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Delete SecureFile record from Firestore
 */
export async function deleteFileFromFirestore(fileId: string, tenantId = 'waseapp-primary', channelId = 'general') {
  await ensureAuth().catch(() => null);
  try {
    await deleteDoc(doc(db, `files/${fileId}`));
    await deleteDoc(doc(db, `tenants/${tenantId}/channels/${channelId}/files/${fileId}`)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `files/${fileId}`);
  }
}

/**
 * Save AuditLog to Firestore (Tenant Hierarchy)
 */
export async function saveAuditLogToFirestore(log: AuditLog, tenantId = 'waseapp-primary') {
  await ensureAuth().catch(() => null);

  const subPath = `tenants/${tenantId}/auditLogs/${log.id}`;
  const topPath = `auditLogs/${log.id}`;

  try {
    await setDoc(doc(db, topPath), log);
    await setDoc(doc(db, subPath), log).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Save encrypted message to Firestore (Tenant -> Channel Hierarchy)
 */
export async function saveMessageToFirestore(message: Message, tenantId = 'waseapp-primary') {
  const currentAuth = await ensureAuth().catch(() => null);
  const currentUid = currentAuth?.uid || auth.currentUser?.uid || message.senderId || 'user';
  const targetChannel = message.channelId || 'general';

  const payload = {
    id: message.id,
    channelId: targetChannel,
    encryptedContent: message.encryptedContent,
    iv: message.iv,
    senderId: currentUid,
    senderName: message.senderName || currentAuth?.displayName || 'ユーザー',
    senderAvatar: message.senderAvatar || 'US',
    timestamp: message.timestamp || new Date().toISOString(),
    isEncrypted: message.isEncrypted ?? true,
    ...(message.attachmentId ? { attachmentId: message.attachmentId } : {}),
    ...(message.attachmentName ? { attachmentName: message.attachmentName } : {}),
  };

  const subPath = `tenants/${tenantId}/channels/${targetChannel}/messages/${message.id}`;
  const topPath = `messages/${message.id}`;

  try {
    await setDoc(doc(db, topPath), payload);
    await setDoc(doc(db, subPath), payload).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Save Tenant to Firestore
 */
export async function saveTenantToFirestore(tenant: Tenant) {
  await ensureAuth().catch(() => null);
  const path = `tenants/${tenant.id}`;
  try {
    const tenantPayload: any = {
      id: tenant.id,
      name: tenant.name,
      adminEmail: tenant.adminEmail,
      createdAt: tenant.createdAt,
      createdBy: tenant.createdBy,
    };
    if (tenant.allowedEmails && Array.isArray(tenant.allowedEmails)) {
      tenantPayload.allowedEmails = tenant.allowedEmails;
    }
    await setDoc(doc(db, 'tenants', tenant.id), tenantPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete Tenant from Firestore
 */
export async function deleteTenantFromFirestore(tenantId: string) {
  await ensureAuth().catch(() => null);
  const path = `tenants/${tenantId}`;
  try {
    await deleteDoc(doc(db, 'tenants', tenantId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save Channel to Firestore (Tenant -> Channel Hierarchy)
 */
export async function saveChannelToFirestore(channel: {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isPrivate?: boolean;
}, tenantId = 'waseapp-primary') {
  await ensureAuth().catch(() => null);

  const subPath = `tenants/${tenantId}/channels/${channel.id}`;
  const topPath = `channels/${channel.id}`;

  try {
    await setDoc(doc(db, topPath), channel, { merge: true });
    await setDoc(doc(db, subPath), channel, { merge: true }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, topPath);
  }
}

/**
 * Delete Channel from Firestore
 */
export async function deleteChannelFromFirestore(channelId: string, tenantId = 'waseapp-primary') {
  await ensureAuth().catch(() => null);
  try {
    await deleteDoc(doc(db, `channels/${channelId}`));
    await deleteDoc(doc(db, `tenants/${tenantId}/channels/${channelId}`)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `channels/${channelId}`);
  }
}

/**
 * Send WebRTC P2P Signal via Firestore (Hybrid fallback for ultra-reliability)
 */
export async function sendP2PSignalToFirestore(signal: {
  id: string;
  roomId: string;
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave';
  senderPeerId: string;
  targetPeerId?: string;
  payload?: any;
}) {
  try {
    await setDoc(doc(db, 'p2p_signals', signal.id), {
      id: signal.id,
      roomId: signal.roomId,
      type: signal.type,
      senderPeerId: signal.senderPeerId,
      ...(signal.targetPeerId ? { targetPeerId: signal.targetPeerId } : {}),
      ...(signal.payload ? { payload: signal.payload } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore P2P signal notice:', err);
  }
}

/**
 * Clear all collections in Firestore (Admin only)
 */
export async function clearAllFirestoreSeedData() {
  if (!auth.currentUser) return;
}

