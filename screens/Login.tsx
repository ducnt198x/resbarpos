import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChefHat, Sparkles, ShieldCheck, Timer, KeyRound } from 'lucide-react';
import { supabase } from '../supabase';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t } = useTheme();
  const { signInDemo } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      // Demo build: Sign In only (no Sign Up)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      onLogin();
    } catch (error: any) {
      console.error(error);
      if (error?.message === 'Failed to fetch') {
        setErrorMsg('Connection failed. Please check your internet connection.');
      } else {
        setErrorMsg(error?.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full h-screen bg-background text-text-main relative transition-colors">
      {/* Left Visual Side */}
      <div className="hidden lg:flex w-1/2 relative bg-[#1a2c26] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop"
            alt="Restaurant Interior"
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center p-12 max-w-lg">
          <div className="size-20 rounded-2xl bg-primary flex items-center justify-center text-background mb-8 shadow-2xl shadow-primary/20">
            <ChefHat size={48} strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-white">{t('Nepos System')}</h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            {t('LoginDescription')}
          </p>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight text-text-main">
              {t('Welcome to Nepos')}
            </h2>
            <p className="text-secondary mt-2">
              {t('Login text')}
            </p>
          </div>

          {/* Trial / Demo Card */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-text-main">{t('Dùng thử 30 ngày')}</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Trial
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1 leading-relaxed">
                  {t('Trải nghiệm bản đầy đủ tính năng (offline). Dữ liệu tự xoá khi hết hạn. Mở đồng bộ/nhập-xuất bằng mã từ server.')}
                </p>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => signInDemo('admin')}
                    className="group rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all p-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-primary" />
                      <span className="text-xs font-black">Demo Admin</span>
                    </div>
                    <p className="text-[10px] text-secondary mt-0.5">Toàn quyền</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => signInDemo('manager')}
                    className="group rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all p-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound size={14} className="text-primary" />
                      <span className="text-xs font-black">Demo QL</span>
                    </div>
                    <p className="text-[10px] text-secondary mt-0.5">Vận hành</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => signInDemo('staff')}
                    className="group rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all p-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Timer size={14} className="text-primary" />
                      <span className="text-xs font-black">Demo NV</span>
                    </div>
                    <p className="text-[10px] text-secondary mt-0.5">Bán hàng</p>
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-secondary">
                  <span className="font-bold">
                    PIN demo: <span className="font-mono text-text-main">0000</span>
                  </span>
                  <span className="font-medium">Cài đặt → “YÊU CẦU ĐỒNG BỘ”</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary ml-1">{t('Email Address')}</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    placeholder="manager@nepos.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl py-3.5 pl-10 pr-4 text-text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary ml-1">{t('Password')}</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl py-3.5 pl-10 pr-12 text-text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-text-main transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm font-bold text-center">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-offset-background focus:ring-primary" />
                <span className="text-secondary group-hover:text-text-main transition-colors">{t('Remember me')}</span>
              </label>
              <a href="#" className="font-bold text-primary hover:text-primary-hover hover:underline">{t('Forgot password?')}</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-background font-bold h-12 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="size-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <>
                  {t('Sign In')} <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
