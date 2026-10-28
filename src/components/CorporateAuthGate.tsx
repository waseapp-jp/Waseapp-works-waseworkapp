import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldAlert,
  Share2,
  Check,
  ExternalLink,
  ShieldCheck,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { User } from '../types';
import {
  signInWithGoogle,
  signInWithGoogleRedirect,
  checkRedirectAuthResult,
  saveUserProfileToFirestore,
} from '../lib/firebase';

interface CorporateAuthGateProps {
  onAuthenticated: (user: User) => void;
}

export const CorporateAuthGate: React.FC<CorporateAuthGateProps> = ({ onAuthenticated }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [showShareGuide, setShowShareGuide] = useState(false);
  const [authStep, setAuthStep] = useState<string>('');

  // Handle redirect sign-in results on component mount
  useEffect(() => {
    let isMounted = true;
    async function handleRedirectResult() {
      try {
        setIsLoading(true);
        setAuthStep('Google 認証の確認中...');
        const fbUser = await checkRedirectAuthResult();
        if (fbUser && isMounted) {
          const email = fbUser.email || '';
          const isSystemAdmin = email.toLowerCase() === 'aimutsu0120@gmail.com';

          const userRecord: User = {
            id: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0] || 'Google ユーザー',
            avatar:
              (fbUser.displayName ? fbUser.displayName.slice(0, 2).toUpperCase() : email.slice(0, 2).toUpperCase()) ||
              'GO',
            role: isSystemAdmin ? 'admin' : 'member',
            roleTitle: isSystemAdmin ? 'システム全体管理者' : 'メンバー',
            status: 'online',
            companyName: '株式会社Waseapp',
            email,
            isSystemAdmin,
          };

          await saveUserProfileToFirestore(userRecord, email);
          onAuthenticated(userRecord);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Redirect result error:', err);
          setErrorMsg(err.message || 'Google 認証処理中にエラーが発生しました。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAuthStep('');
        }
      }
    }

    handleRedirectResult();
    return () => {
      isMounted = false;
    };
  }, [onAuthenticated]);

  // Derive public share URL from dev URL if needed
  const getShareableUrl = () => {
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('ais-dev-')) {
      return currentOrigin.replace('ais-dev-', 'ais-pre-');
    }
    return 'https://ais-pre-eid6edxtqoljoz4grdmor2-554926909913.asia-northeast1.run.app';
  };

  const handleCopyShareLink = () => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    });
  };

  // Google Authentication Handler via Popup
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setAuthStep('Google アカウントでログイン中...');
    try {
      const fbUser = await signInWithGoogle();
      const email = fbUser.email || '';
      const isSystemAdmin = email.toLowerCase() === 'aimutsu0120@gmail.com';

      const userRecord: User = {
        id: fbUser.uid,
        name: fbUser.displayName || email.split('@')[0] || 'Google ユーザー',
        avatar:
          (fbUser.displayName ? fbUser.displayName.slice(0, 2).toUpperCase() : email.slice(0, 2).toUpperCase()) ||
          'GO',
        role: isSystemAdmin ? 'admin' : 'member',
        roleTitle: isSystemAdmin ? 'システム全体管理者' : 'メンバー',
        status: 'online',
        companyName: '株式会社Waseapp',
        email,
        isSystemAdmin,
      };

      await saveUserProfileToFirestore(userRecord, email);
      onAuthenticated(userRecord);
    } catch (err: any) {
      console.error('Google auth error:', err);
      // Informative user-friendly guidance if popup is blocked (especially in iPad / Safari)
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setErrorMsg('ポップアップがブラウザにブロックされました。下の「ページ移動でログイン (Safari/iPad推奨)」をご利用ください。');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('ログインがキャンセルされました。もう一度お試しください。');
      } else {
        setErrorMsg(err.message || 'Google 認証に失敗しました。');
      }
    } finally {
      setIsLoading(false);
      setAuthStep('');
    }
  };

  // Google Authentication Handler via Redirect (for Safari / iPad / iFrame restrictions)
  const handleGoogleLoginRedirect = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setAuthStep('Google ログイン画面へ移動中...');
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      console.error('Google redirect auth error:', err);
      setErrorMsg(err.message || 'Google ページ移動ログインでエラーが発生しました。');
      setIsLoading(false);
      setAuthStep('');
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none pt-safe pb-safe">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-indigo-600/15 via-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Nav */}
      <header className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white">Waseapp Enterprise</div>
            <div className="text-[11px] text-slate-400 font-medium">Google Account SSO 専用ワークスペース</div>
          </div>
        </div>

        <button
          onClick={() => setShowShareGuide(!showShareGuide)}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">共有URLを取得</span>
          <span className="sm:hidden">共有</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 relative overflow-y-auto overscroll-contain">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Logo & Headline */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto shadow-xl shadow-slate-950/60 mb-3 border border-slate-200">
              {/* Google Official Logo Icon */}
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Google アカウントでログイン
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              本ワークスペースのログイン認証は<strong className="text-slate-200">Google アカウントのみ</strong>に対応しています
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Share Link Guide */}
          {showShareGuide && (
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs space-y-2.5">
              <div className="flex items-center space-x-1.5 font-bold text-indigo-300">
                <Globe className="w-4 h-4" />
                <span>他メンバー・招待用共有URL</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                開発用URL（<code className="text-amber-400 font-mono">ais-dev-</code>）は開発者以外401拒否されます。他の参加者には以下の<strong>共有用公開URL</strong>をご案内ください。
              </p>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] break-all select-all">
                {getShareableUrl()}
              </div>
              <button
                id="btn-copy-public-link"
                onClick={handleCopyShareLink}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md active:scale-[0.98] cursor-pointer"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>共有URLをコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>共有URLをクリップボードにコピー</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Google Login Exclusive Actions */}
          <div className="space-y-3 pt-1">
            {/* Primary Google Login Button (Popup) */}
            <button
              id="btn-google-login-primary"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full min-h-[52px] flex items-center justify-center space-x-3.5 py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm sm:text-base shadow-xl shadow-white/5 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 cursor-pointer border border-slate-200"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading && authStep ? authStep : 'Google アカウントでログイン'}</span>
            </button>

            {/* Alternative Direct Redirect Button for Safari / iPad */}
            <button
              id="btn-google-login-redirect"
              onClick={handleGoogleLoginRedirect}
              disabled={isLoading}
              className="w-full min-h-[46px] flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 font-semibold text-xs border border-slate-700/80 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>ページ全画面移動でログイン (iPad・Safari推奨)</span>
            </button>
          </div>

          {/* Security & Domain Policy Details */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-start space-x-2.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <strong className="text-slate-200">セキュア SSO 認証</strong>
                <p className="text-slate-400 mt-0.5">
                  IDやパスワードを直接入力・保存することなく、Google の二要素認証と暗号化トークンにより安全に保護されます。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                対応アカウント
              </span>
              <span className="text-slate-400">@gmail.com / Google Workspace</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/80 text-center text-xs text-slate-500 z-10 flex items-center justify-center gap-2">
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span>エンドツーエンド暗号化 (AES-256-GCM) 接続保護</span>
      </footer>
    </div>
  );
};
