import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChefHat, Shield, Briefcase, UserRound, Users } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin();
    } catch (error: any) {
      console.error(error);
      if (error.message === 'Failed to fetch') {
        setErrorMsg('Connection failed. Please check your internet connection.');
      } else {
        setErrorMsg(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const DemoRoleCard = ({
    title,
    subtitle,
    icon,
    onClick,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left p-4 rounded-2xl border border-border bg-surface hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-black text-text-main">{title}</div>
          <div className="text-xs font-bold text-secondary mt-1">{subtitle}</div>
        </div>
        <ArrowRight className="text-secondary group-hover:text-primary transition-colors" size={18} />
      </div>
    </button>
  );

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
          <p className="text-lg text-gray-300 leading-relaxed">{t('LoginDescription')}</p>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight text-text-main">{t('Welcome to Nepos')}</h2>
            <p className="text-secondary mt-2">{t('Login text')}</p>
          </div>

          {/* Trial / Demo */}
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <div className="font-black text-text-main">Trial / Demo</div>
                  <div className="text-xs font-bold text-secondary">30 ngày trải nghiệm · Full tính năng</div>
                </div>
              </div>
              <div className="text-[11px] font-black px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">PIN: 0000</div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <DemoRoleCard
                title="Demo Admin"
                subtitle="Toàn quyền cấu hình & vận hành"
                icon={<Users size={18} />}
                onClick={() => signInDemo('admin')}
              />
              <DemoRoleCard
                title="Demo Quản lý"
                subtitle="Quản lý ca, báo cáo, kiểm soát"
                icon={<Briefcase size={18} />}
                onClick={() => signInDemo('manager')}
              />
              <DemoRoleCard
                title="Demo Nhân viên"
                subtitle="Bán hàng hằng ngày, thao tác nhanh"
                icon={<UserRound size={18} />}
                onClick={() => signInDemo('staff')}
              />
            </div>
            <div className="mt-3 text-xs text-secondary font-medium">
              Bản demo chạy cục bộ, tự xoá sau 30 ngày. Nếu cần đồng bộ: vào <strong className="text-text-main">Cài đặt</strong> → <strong className="text-text-main">YÊU CẦU ĐỒNG BỘ</strong>.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <div className="text-xs font-bold text-secondary">Hoặc đăng nhập</div>
            <div className="h-px bg-border flex-1" />
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3.5 bg-primary hover:bg-primary-hover text-background rounded-xl font-black transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <>
                  {t('Sign In')}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
