import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Cpu,
  RefreshCw,
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Download,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { AuditLog } from '../types';
import {
  deriveKeyFromPassphrase,
  encryptText,
  decryptText,
  getCurrentKeyFingerprint,
} from '../lib/crypto';

interface SecurityVaultViewProps {
  auditLogs: AuditLog[];
  keyFingerprint: string;
  onKeyRotated: (newFingerprint: string) => void;
  onAddAuditLog: (log: { action: string; detail: string; category: any; status: any }) => void;
}

export const SecurityVaultView: React.FC<SecurityVaultViewProps> = ({
  auditLogs,
  keyFingerprint,
  onKeyRotated,
  onAddAuditLog,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [isDeriving, setIsDeriving] = useState(false);
  const [activeFingerprint, setActiveFingerprint] = useState(keyFingerprint);

  // Live Crypto Sandbox test
  const [testPlainText, setTestPlainText] = useState('早稲田エンタープライズ 最高機密業務データ');
  const [cipherOutput, setCipherOutput] = useState<{ cipherText: string; iv: string } | null>(null);
  const [decryptedOutput, setDecryptedOutput] = useState<string | null>(null);

  const handleRotateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim() || isDeriving) return;

    try {
      setIsDeriving(true);
      const { fingerprint } = await deriveKeyFromPassphrase(passphrase);
      setActiveFingerprint(fingerprint);
      onKeyRotated(fingerprint);

      onAddAuditLog({
        action: 'KEY_ROTATION_SUCCESS',
        detail: `マスターパスフレーズから新キーを導出 (指紋: ${fingerprint})`,
        category: 'crypto',
        status: 'verified',
      });

      setPassphrase('');
      alert(`暗号化キーを正常に更新しました。\n新しい指紋: ${fingerprint}`);
    } catch (err) {
      console.error('Key rotation failed:', err);
      alert('暗号化キーの更新に失敗しました。');
    } finally {
      setIsDeriving(false);
    }
  };

  const runLiveCryptoTest = async () => {
    try {
      const encrypted = await encryptText(testPlainText);
      setCipherOutput(encrypted);
      const decrypted = await decryptText(encrypted.cipherText, encrypted.iv);
      setDecryptedOutput(decrypted);

      onAddAuditLog({
        action: 'CRYPTO_SANDBOX_VERIFY',
        detail: `Web Crypto API AES-256-GCM リアルタイム暗号化/復号テスト成功 (IV: 96bit)`,
        category: 'crypto',
        status: 'verified',
      });
    } catch (err) {
      console.error('Sandbox error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>セキュリティ & 暗号化コントロールセンター</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                ゼロ知識アーキテクチャ (Zero-Knowledge)
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Web Crypto API (AES-256-GCM / PBKDF2) による完全な端末側データ保護
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
          <Key className="w-3.5 h-3.5 text-indigo-400" />
          <span>指紋: {activeFingerprint}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>暗号アルゴリズム</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-base font-bold text-white font-mono">AES-256-GCM</div>
            <div className="text-[11px] text-slate-500 mt-1">
              96-bit ランダムIV + 128-bit 認証タグ (改ざん完全防止)
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>鍵導出関数 (KDF)</span>
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-base font-bold text-white font-mono">PBKDF2-HMAC-SHA256</div>
            <div className="text-[11px] text-slate-500 mt-1">
              100,000 ラウンド反復ストレッチング + 固定ソルト
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ミーティング通信</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-base font-bold text-white font-mono">WebRTC DTLS 1.3 / P2P</div>
            <div className="text-[11px] text-slate-500 mt-1">
              サーバー中継なし・SAS認証コードによる中間者攻撃検出
            </div>
          </div>
        </div>

        {/* Row 2: Key Management & Live Crypto Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Key Management Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>マスター暗号化パスフレーズの更新 (鍵ローテーション)</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                ワークスペースの暗号化鍵はクライアント側のメモリ内にのみ保持され、サーバーには決して送信されません。パスフレーズを変更すると、即座に256ビットAES鍵が再導出されます。
              </p>

              <form onSubmit={handleRotateKey} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    新しいワークスペース・パスフレーズ
                  </label>
                  <input
                    type="password"
                    placeholder="強固なパスフレーズを入力..."
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-emerald-400">
                    現在の鍵指紋: {activeFingerprint}
                  </span>
                  <button
                    type="submit"
                    disabled={!passphrase.trim() || isDeriving}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    {isDeriving ? '鍵を再導出中...' : '鍵を更新'}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>ゼロ知識保証: サーバーは復号鍵を保有しません</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          {/* Interactive Web Crypto Sandbox Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-white">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Web Crypto API リアルタイム暗号化検証サンドボックス</span>
              </div>
              <button
                onClick={runLiveCryptoTest}
                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>暗号化を実行</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">平文入力 (Plaintext):</label>
                <input
                  type="text"
                  value={testPlainText}
                  onChange={(e) => setTestPlainText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">
                  AES-256-GCM 暗号文 (Ciphertext Base64) & IV:
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-indigo-300 break-all min-h-[48px]">
                  {cipherOutput ? (
                    <>
                      <div>
                        <span className="text-slate-500">IV:</span> {cipherOutput.iv}
                      </div>
                      <div>
                        <span className="text-slate-500">Cipher:</span> {cipherOutput.cipherText}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-600">「暗号化を実行」ボタンを押すと生成されます</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">復号検証結果 (Decrypted):</label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-[11px] text-emerald-400 min-h-[28px]">
                  {decryptedOutput ? `✓ ${decryptedOutput}` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Audit Trail Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white">セキュリティ監査ログ (Security Audit Trail)</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">リアルタイム監査フィード</span>
          </div>

          <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto font-mono text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-slate-850">
                <div className="flex items-center space-x-3 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      log.status === 'verified'
                        ? 'bg-emerald-500'
                        : log.status === 'warning'
                        ? 'bg-rose-500'
                        : 'bg-indigo-500'
                    }`}
                  />
                  <span className="text-slate-500 text-[11px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-indigo-400 font-bold text-[11px] shrink-0">[{log.action}]</span>
                  <span className="text-slate-300 truncate text-[11px]">{log.detail}</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded shrink-0">
                  {log.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
