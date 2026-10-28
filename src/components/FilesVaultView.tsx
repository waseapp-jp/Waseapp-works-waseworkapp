import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Download,
  Lock,
  ShieldCheck,
  Trash2,
  Share2,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Search,
  Eye,
  CheckCircle,
  File,
} from 'lucide-react';
import { SecureFile, User } from '../types';
import { decryptBinaryFile } from '../lib/crypto';
import { hasPermission } from '../lib/permissions';

interface FilesVaultViewProps {
  files: SecureFile[];
  currentUser: User;
  onUploadFile: (file: File) => Promise<{ id: string; name: string }>;
  onDeleteFile: (fileId: string) => void;
  onShareToChat: (file: SecureFile) => void;
}

export const FilesVaultView: React.FC<FilesVaultViewProps> = ({
  files,
  currentUser,
  onUploadFile,
  onDeleteFile,
  onShareToChat,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; mimeType: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return FileText;
    }
    if (mimeType.includes('sheet') || mimeType.includes('csv') || mimeType.includes('excel')) {
      return FileSpreadsheet;
    }
    if (mimeType.includes('image')) {
      return FileImage;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) {
      return FileArchive;
    }
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleProcessFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(`ブラウザ内 AES-256-GCM 暗号化中: ${file.name}`);
      await onUploadFile(file);
      setUploadProgress(null);
    } catch (err) {
      console.error('File upload/encryption error:', err);
      alert('ファイルの暗号化またはアップロードに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAndDecrypt = async (file: SecureFile) => {
    try {
      const blob = await decryptBinaryFile(file.encryptedData, file.iv, file.mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Decryption failed:', err);
      alert('ファイルの復号に失敗しました。暗号化キーを確認してください。');
    }
  };

  const handlePreview = async (file: SecureFile) => {
    try {
      const blob = await decryptBinaryFile(file.encryptedData, file.iv, file.mimeType);
      const url = URL.createObjectURL(blob);
      setPreviewFile({ name: file.name, url, mimeType: file.mimeType });
    } catch (err) {
      console.error('Preview failed:', err);
    }
  };

  const canUpload = hasPermission(currentUser.role, 'canUploadFile');
  const canDelete = hasPermission(currentUser.role, 'canDeleteFile');

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>セキュアファイル共有 Vault</span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
              <Lock className="w-3 h-3" /> ゼロ知識 AES-256
            </span>
          </h1>
          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
            保管数: {files.length} 件
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ファイルを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
            disabled={!canUpload}
            className="hidden"
          />
          <button
            id="btn-upload-file-vault"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !canUpload}
            title={!canUpload ? "閲覧者 (Viewer) はファイルのアップロード権限がありません" : "暗号化ファイルをアップロード"}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold shadow transition ${
              canUpload
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? '暗号化中...' : 'ファイル暗号化アップロード'}</span>
            {!canUpload && <Lock className="w-3 h-3 ml-1" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Drag and drop upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleProcessFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/30'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-indigo-400 flex items-center justify-center mx-auto mb-2">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">
            ここにファイルをドラッグ＆ドロップ、またはクリックして選択
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
            ファイルはサーバー送信前に**ブラウザ内(Web Crypto API)で256ビットAES-GCM暗号化**されます。
            サーバー管理者は平文ファイルの中身を一切閲覧できません。
          </p>
          {uploadProgress && (
            <div className="mt-3 text-xs text-emerald-400 font-mono animate-pulse">
              🔒 {uploadProgress}
            </div>
          )}
        </div>

        {/* Files Table / List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>暗号化ストレージ一覧</span>
            <span className="text-[11px] text-emerald-400 font-mono">
              全ファイル SHA-256 チェックサム検証対応
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                ファイルは見つかりませんでした。
              </div>
            ) : (
              filteredFiles.map((file) => {
                const Icon = getFileIcon(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-850 transition group"
                  >
                    {/* Left: File Info */}
                    <div className="flex items-center space-x-3 truncate max-w-[60%]">
                      <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 truncate group-hover:text-indigo-300">
                          {file.name}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{file.uploadedBy}</span>
                          <span>•</span>
                          <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="font-mono text-emerald-400 truncate max-w-[120px]">
                            SHA: {file.checksum.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Preview (if image or text) */}
                      {(file.mimeType.includes('image') ||
                        file.mimeType.includes('text') ||
                        file.mimeType.includes('pdf')) && (
                        <button
                          onClick={() => handlePreview(file)}
                          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          title="安全に復号してプレビュー"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span className="hidden sm:inline">プレビュー</span>
                        </button>
                      )}

                      {/* Decrypt & Download */}
                      <button
                        onClick={() => handleDownloadAndDecrypt(file)}
                        className="flex items-center space-x-1 px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow transition"
                        title="ブラウザ内で安全に復号してダウンロード"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>復号ダウンロード</span>
                      </button>

                      {/* Share to Chat */}
                      <button
                        onClick={() => onShareToChat(file)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition"
                        title="チャットに共有"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      {canDelete && (
                        <button
                          onClick={() => onDeleteFile(file.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition opacity-0 group-hover:opacity-100"
                          title="ファイルを削除 (管理者限定)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white truncate">{previewFile.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-1.5 py-0.5 rounded">
                  端末内復号済
                </span>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewFile.url);
                  setPreviewFile(null);
                }}
                className="text-slate-400 hover:text-white text-xs px-2 py-1"
              >
                ✕ 閉じる
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-950">
              {previewFile.mimeType.includes('image') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[60vh] rounded-lg object-contain"
                />
              ) : (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[60vh] rounded border border-slate-800 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
