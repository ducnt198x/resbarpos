import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Printer, Wifi, Lock, LogOut, ChevronRight, Save, X, Check, AlertCircle, Loader2, DollarSign, Sun, Wallet, ShieldAlert, Briefcase, User, Smartphone } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../supabase';
import { printTestTicket } from '../utils/printService';

interface SettingsProps {
  onLogout: () => void;
}

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme, language, setLanguage, brightness, setBrightness, t } = useTheme();

  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankConfig, setBankConfig] = useState(() => {
    const saved = localStorage.getItem('bank_config');
    return saved ? JSON.parse(saved) : { bankId: '', accountNo: '', accountName: '', template: 'compact2' };
  });

  // Print Configuration State
  const [printConfig, setPrintConfig] = useState(() => {
    const saved = localStorage.getItem('print_config');
    return saved ? JSON.parse(saved) : { method: 'browser' };
  });

  const [printerStatus, setPrinterStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connected');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchUserRole();
    fetchBanks();
  }, []);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (user.email === 'ducnt198x@gmail.com') {
        setRole('admin');
      } else {
        const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (data) setRole(data.role as 'admin' | 'staff');
      }
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await fetch('https://api.vietqr.io/v2/banks');
      const json = await response.json();
      if (json.data) setBanks(json.data);
    } catch (e) { console.error(e); }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveBankConfig = () => {
    localStorage.setItem('bank_config', JSON.stringify(bankConfig));
    showNotification(t('Settings Saved'), 'success');
  };

  const handleSavePrintConfig = () => {
    localStorage.setItem('print_config', JSON.stringify(printConfig));
    showNotification(t('Print Settings Saved'), 'success');
  };

  const handleTestPrint = () => {
    try {
      printTestTicket();
      showNotification('Test receipt sent', 'success');
    } catch (e) { showNotification('Print failed', 'error'); }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      showNotification('New passwords do not match', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
      if (error) throw error;
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      showNotification('Password updated successfully', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Failed to update password', 'error');
    } finally { setIsSavingPassword(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative transition-colors">
      {notification && (
        <div className={`fixed top-24 right-8 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300 border
          ${notification.type === 'success' ? 'bg-surface border-green-500/30 text-green-500' : 'bg-surface border-red-500/30 text-red-500'}`}>
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      <div className="h-20 border-b border-border flex items-center px-8 bg-background/90 backdrop-blur shrink-0 z-10 sticky top-0">
         <div>
           <h1 className="text-text-main text-2xl font-bold tracking-tight">{t('System Settings')}</h1>
           <p className="text-secondary text-sm mt-1">{t('Manage configuration')}</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">
          
          {/* SECTION 1: Personal */}
          <section>
            <div className="flex items-center gap-2 mb-4"><User size={20} className="text-primary" /><h2 className="text-lg font-bold text-text-main">Personal Preferences</h2></div>
            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-soft">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4"><div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><Globe size={20} /></div><div><p className="font-bold text-text-main">{t('Language')}</p><p className="text-sm text-secondary">{t('Choose display language')}</p></div></div>
                <div className="bg-background p-1 rounded-lg flex border border-border">
                  <button onClick={() => setLanguage('en')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'en' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}>English</button>
                  <button onClick={() => setLanguage('vi')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'vi' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}>Vietnamese</button>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4"><div className="size-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500"><Moon size={20} /></div><div><p className="font-bold text-text-main">{t('Dark Mode')}</p><p className="text-sm text-secondary">{t('Adjust appearance')}</p></div></div>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-12 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} /></button>
              </div>
              <button onClick={() => setShowPasswordModal(true)} className="w-full text-left flex items-center justify-between p-5 hover:bg-border/30 transition-colors group"><div className="flex items-center gap-4"><div className="size-10 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-500"><Lock size={20} /></div><div><p className="font-bold text-text-main group-hover:text-primary transition-colors">{t('Change Password')}</p><p className="text-sm text-secondary">{t('Update credentials')}</p></div></div><ChevronRight className="text-secondary" /></button>
            </div>
          </section>

          {/* SECTION 2: Business (Admin Only) */}
          {role === 'admin' ? (
            <section className="space-y-8">
              {/* Bank Config */}
              <div>
                <div className="flex items-center gap-2 mb-4"><Briefcase size={20} className="text-primary" /><h2 className="text-lg font-bold text-text-main">Business Configuration</h2></div>
                <div className="bg-surface rounded-xl border border-border p-6 shadow-soft space-y-6">
                  <div className="flex items-start gap-4 mb-2"><div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Wallet size={20} /></div><div><h3 className="font-bold text-text-main">{t('VietQR Setup')}</h3><p className="text-sm text-secondary">{t('Setup bank for payment QR codes')}</p></div></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-secondary uppercase tracking-wider">{t('Bank')}</label>
                      <select value={bankConfig.bankId} onChange={(e) => setBankConfig({ ...bankConfig, bankId: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-main outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                        <option value="">{t('Select Bank')}</option>
                        {banks.map((bank) => (<option key={bank.id} value={bank.shortName}>{bank.shortName} - {bank.name}</option>))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-secondary uppercase tracking-wider">{t('Account Number')}</label><input type="text" value={bankConfig.accountNo} onChange={(e) => setBankConfig({ ...bankConfig, accountNo: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-main outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. 1903xxx" /></div>
                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-secondary uppercase tracking-wider">{t('Account Owner')}</label><input type="text" value={bankConfig.accountName} onChange={(e) => setBankConfig({ ...bankConfig, accountName: e.target.value.toUpperCase() })} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-main outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. NGUYEN VAN A" /></div>
                    <div className="flex flex-col justify-end"><button onClick={handleSaveBankConfig} className="w-full h-10 bg-primary text-background font-bold rounded-lg hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"><Save size={18} /> {t('Save Bank Settings')}</button></div>
                  </div>
                </div>
              </div>

              {/* Printing Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-4"><Printer size={20} className="text-primary" /><h2 className="text-lg font-bold text-text-main">Printing Configuration</h2></div>
                <div className="bg-surface rounded-xl border border-border p-6 shadow-soft space-y-6">
                  <div className="flex items-start gap-4 mb-2"><div className="size-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0"><Smartphone size={20} /></div><div><h3 className="font-bold text-text-main">Printer Protocol</h3><p className="text-sm text-secondary">Choose how the app communicates with your printer</p></div></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-secondary uppercase tracking-wider">Method</label>
                      <select 
                        value={printConfig.method} 
                        onChange={(e) => setPrintConfig({ ...printConfig, method: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-main outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="browser">Browser Default (PC/Laptop)</option>
                        <option value="rawbt">RawBT App (Android Bluetooth/USB)</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end gap-3">
                      <button onClick={handleSavePrintConfig} className="w-full h-10 bg-primary text-background font-bold rounded-lg hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"><Save size={18} /> {t('Save Print Config')}</button>
                      <button onClick={handleTestPrint} className="w-full h-10 bg-background border border-border text-text-main font-bold rounded-lg hover:border-primary transition-all flex items-center justify-center gap-2"><Printer size={18} /> {t('Test Print')}</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="opacity-80 grayscale">
              <div className="bg-surface rounded-xl border border-border p-6 shadow-soft flex items-center justify-center gap-3"><ShieldAlert size={20} className="text-secondary" /><p className="text-sm text-secondary font-bold">Administrator access required to manage business settings.</p></div>
            </section>
          )}

          <div className="text-center pt-4"><p className="text-xs text-secondary font-medium">App Version: 1.0.7 (RawBT Support)</p></div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center"><h3 className="font-bold text-text-main text-lg">{t('Change Password')}</h3><button onClick={() => setShowPasswordModal(false)} className="text-secondary hover:text-text-main p-2 hover:bg-border rounded-lg transition-colors"><X size={20} /></button></div>
            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <div className="space-y-2"><label className="text-xs font-bold text-secondary uppercase">{t('Current Password')}</label><input type="password" required className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="••••••••" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} /></div>
              <div className="space-y-2"><label className="text-xs font-bold text-secondary uppercase">{t('New Password')}</label><input type="password" required className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="••••••••" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} /></div>
              <div className="space-y-2"><label className="text-xs font-bold text-secondary uppercase">{t('Confirm New Password')}</label><input type="password" required className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="••••••••" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} /></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-3 rounded-lg border border-border text-text-main font-bold text-sm hover:bg-border transition-colors">{t('Cancel')}</button><button type="submit" disabled={isSavingPassword} className="flex-1 py-3 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">{isSavingPassword ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{t('Update')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
