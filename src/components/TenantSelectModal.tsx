import React from 'react';
import {
  X,
  Building2,
  Check,
  ArrowRight,
  Shield,
  Users,
  ExternalLink,
} from 'lucide-react';
import { Tenant, User } from '../types';

interface TenantSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  currentUser: User;
  onSelectTenant: (tenant: Tenant) => void;
}

export const TenantSelectModal: React.FC<TenantSelectModalProps> = ({
  isOpen,
  onClose,
  tenants,
  currentTenant,
  currentUser,
  onSelectTenant,
}) => {
  if (!isOpen) return null;

  const userEmail = currentUser.email?.toLowerCase() || '';
  const isSystemAdmin = userEmail === 'aimutsu0120@gmail.com' || currentUser.isSystemAdmin;

  // Filter accessible tenants:
  // - System admin sees all tenants
  // - Regular users see tenants where they are adminEmail OR allowedEmails includes them
  const accessibleTenants = isSystemAdmin
    ? tenants
    : tenants.filter(
        (t) =>
          t.adminEmail?.toLowerCase() === userEmail ||
          (t.allowedEmails && t.allowedEmails.some((e) => e.toLowerCase() === userEmail))
      );

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">所属テナント（会社）を選択</h2>
              <p className="text-[11px] text-slate-400">
                アクセス可能なワークスペースを選択して切り替えます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tenant List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {accessibleTenants.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs bg-slate-950/60 rounded-xl border border-dashed border-slate-800 p-4">
              <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">所属可能な会社がありません</p>
              <p className="text-[11px] text-slate-500 mt-1">
                会社の管理者にメールアドレス（{userEmail}）の追加を依頼してください。
              </p>
            </div>
          ) : (
            accessibleTenants.map((tenant) => {
              const isCurrent = currentTenant?.id === tenant.id;
              const isBoss = tenant.adminEmail?.toLowerCase() === userEmail;
              const memberCount = (tenant.allowedEmails?.length || 0) + 1;

              return (
                <div
                  key={tenant.id}
                  onClick={() => {
                    onSelectTenant(tenant);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 group-hover:bg-indigo-900 group-hover:text-indigo-200 transition'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                          {tenant.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-900 text-indigo-300 border border-indigo-700 font-bold">
                            現在のワークスペース
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{memberCount} 名</span>
                        </span>
                        <span>•</span>
                        {isBoss ? (
                          <span className="text-indigo-400 font-semibold flex items-center gap-0.5">
                            <Shield className="w-3 h-3" />
                            <span>責任者 (管理者)</span>
                          </span>
                        ) : isSystemAdmin ? (
                          <span className="text-amber-400 font-semibold">システム管理者</span>
                        ) : (
                          <span className="text-slate-400">一般メンバー</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isCurrent ? (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <span>切り替える</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Google アカウント: <strong className="text-slate-300 font-mono">{userEmail}</strong></span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
