import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Camera,
  Upload,
  Check,
  Building,
  Mail,
  Shield,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { User } from '../types';

interface ProfileEditModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (updatedProfile: Partial<User>) => Promise<void>;
}

// Preset avatars
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
];

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSaveProfile,
}) => {
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [roleTitle, setRoleTitle] = useState(currentUser.roleTitle || '');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [avatarInitials, setAvatarInitials] = useState(currentUser.avatar || 'US');
  const [status, setStatus] = useState<User['status']>(currentUser.status || 'online');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('画像サイズは2MB以下にしてください。');
        return;
      }
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.trim()) {
      setAvatarInitials(val.trim().slice(0, 2).toUpperCase());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('名前を入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await onSaveProfile({
        name: name.trim(),
        email: email.trim().toLowerCase() || undefined,
        roleTitle: roleTitle.trim(),
        photoURL: photoURL.trim() || undefined,
        avatar: avatarInitials.trim() || name.trim().slice(0, 2).toUpperCase(),
        status,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg('プロフィールの保存に失敗しました: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">プロフィール設定・編集</h2>
              <p className="text-[11px] text-slate-400">表示名やアイコン画像、役職を変更できます</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Avatar Preview & Customizer */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group shrink-0">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-lg shadow-black/40"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-2xl font-bold border-2 border-indigo-500/50 shadow-lg shadow-black/40 font-mono">
                  {avatarInitials}
                </div>
              )}
              <label
                htmlFor="profile-avatar-upload"
                className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-white text-[10px] gap-1"
                title="画像を変更"
              >
                <Camera className="w-5 h-5" />
                <span>変更</span>
              </label>
              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2 w-full">
              <div className="text-xs font-semibold text-white">プロフィール画像</div>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label
                  htmlFor="profile-avatar-upload-btn"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>端末から画像アップロード</span>
                </label>
                <input
                  id="profile-avatar-upload-btn"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL('')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 text-xs transition"
                  >
                    画像をクリア (頭文字表示)
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                JPEG, PNG, WebP形式 (2MB以内) または下記のプリセットから選択
              </p>
            </div>
          </div>

          {/* Preset Avatars Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>プリセット写真から選択</span>
            </label>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoURL(url)}
                  className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition relative shrink-0 ${
                    photoURL === url
                      ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="preset" className="w-full h-full object-cover" />
                  {photoURL === url && (
                    <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Photo URL Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>画像 URL を直接指定 (任意)</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Name & Role Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                表示名 (氏名) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例: 山田 太郎"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>メールアドレス</span>
                <span className="text-[10px] text-indigo-400 font-normal">企業メンバー照合・ログイン用</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="email"
                  placeholder="例: yamada@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                役職・肩書 (任意)
              </label>
              <input
                type="text"
                placeholder="例: プロダクトマネージャー"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              現在のステータス
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('online')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  status === 'online'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>オンライン</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('busy')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  status === 'busy'
                    ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>取り込み中</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('away')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  status === 'away'
                    ? 'bg-slate-800 border-slate-600 text-slate-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>離席中</span>
              </button>
            </div>
          </div>

          {/* Readonly Account Info */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-1 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-500" />
                <span>Google アカウント:</span>
              </span>
              <span className="font-mono text-slate-300">{currentUser.email || '未連携'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building className="w-3 h-3 text-slate-500" />
                <span>現在の会社:</span>
              </span>
              <span className="font-semibold text-indigo-300">{currentUser.companyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-slate-500" />
                <span>システム権限:</span>
              </span>
              <span className="font-mono text-slate-300">
                {currentUser.isSystemAdmin ? 'System Admin' : currentUser.role.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              id="btn-save-profile"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '保存中...' : 'プロフィールを保存'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
