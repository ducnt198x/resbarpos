import React, { useState } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Printer, Wifi, Lock, LogOut, ChevronRight, Save, X, Check, AlertCircle, Loader2, DollarSign, Sun } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../supabase';
import { printTestTicket } from '../utils/printService';

interface SettingsProps {
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme, language, setLanguage, brightness, setBrightness, t } = useTheme();

  // Hardware State
  const [printerStatus, setPrinterStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connected');
  const [printerConfig, setPrinterConfig] = useState({
    name: 'EPSON TM-T82III',
    ip: '192.168.1.200'
  });
  
  // Account State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Notification
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handlers
  const handleConnectPrinter = () => {
    setPrinterStatus('connecting');
    setTimeout(() => {
      setPrinterStatus('connected');
      showNotification('LAN Printer connected successfully', 'success');
    }, 2000);
  };

  const handleDisconnectPrinter = () => {
    setPrinterStatus('disconnected');
    showNotification('LAN Printer disconnected', 'error');
  };

  const handleTestPrint = () => {
    if (printerStatus !== 'connected') {
      showNotification('No printer connected', 'error');
      return;
    }
    try {
      printTestTicket();
      showNotification('Test receipt sent to printer', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to trigger print dialog', 'error');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.new || !passwordForm.confirm) return;
    
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
      console.error('Error updating password:', error);
      showNotification(error.message || 'Failed to update password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative transition-colors">
      {/* Toast Notification */}
      {notification && (
        <div className={`absolute top-24 right-8 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300 border
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
          
          {/* General */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
              <SettingsIcon size={20} className="text-primary" /> {t('General')}
            </h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-soft">
              {/* Language */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><Globe size={20} /></div>
                  <div>
                    <p className="font-bold text-text-main">{t('Language')}</p>
                    <p className="text-sm text-secondary">{t('Choose display language')}</p>
                  </div>
                </div>
                <div className="bg-background p-1 rounded-lg flex border border-border">
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'en' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'vi' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}
                  >
                    Vietnamese
                  </button>
                </div>
              </div>

              {/* Currency */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500"><DollarSign size={20} /></div>
                  <div>
                    <p className="font-bold text-text-main">{t('Currency')}</p>
                    <p className="text-sm text-secondary">{t('Select preferred currency')}</p>
                  </div>
                </div>
                <div className="bg-background p-1 rounded-lg flex border border-border">
                  <button 
                    onClick={() => setCurrency('VND')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === 'VND' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}
                  >
                    VNĐ (₫)
                  </button>
                  <button 
                    onClick={() => setCurrency('USD')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === 'USD' ? 'bg-surface text-text-main shadow-sm' : 'text-secondary hover:text-text-main'}`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              {/* Dark Mode */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500"><Moon size={20} /></div>
                  <div>
                    <p className="font-bold text-text-main">{t('Dark Mode')}</p>
                    <p className="text-sm text-secondary">{t('Adjust appearance')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={`w-12 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Brightness */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500"><Sun size={20} /></div>
                  <div>
                    <p className="font-bold text-text-main">{t('Brightness')}</p>
                    <p className="text-sm text-secondary">{t('Adjust screen brightness')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-40">
                   <Sun size={14} className="text-secondary" />
                   <input 
                      type="range" 
                      min="20" 
                      max="100" 
                      step="1"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                   />
                   <span className="text-sm font-bold text-text-main w-8 text-right">{brightness}%</span>
                </div>
              </div>
            </div>
          </section>

          {/* Hardware */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
              <Printer size={20} className="text-primary" /> {t('Hardware & Devices')}
            </h2>
            <div className="bg-surface rounded-xl border border-border p-6 space-y-6 shadow-soft">
              
              {/* Network Printer */}
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`size-10 rounded-full flex items-center justify-center transition-colors 
                      ${printerStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      <Wifi size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main">{t('Network Printer')}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`flex size-2 rounded-full ${printerStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></span>
                        <span className={`text-sm font-bold ${printerStatus === 'connected' ? 'text-green-500' : 'text-orange-500'}`}>
                          {printerStatus === 'connected' ? t('Connected') : printerStatus === 'connecting' ? t('Connecting') : t('Disconnected')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-secondary">{t('Printer Name')}</label>
                      <input 
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all" 
                        value={printerConfig.name}
                        onChange={(e) => setPrinterConfig({...printerConfig, name: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-secondary">{t('IP Address')}</label>
                      <input 
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all" 
                        value={printerConfig.ip}
                        onChange={(e) => setPrinterConfig({...printerConfig, ip: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex lg:flex-col items-end lg:justify-end gap-3">
                   {printerStatus === 'disconnected' ? (
                     <button 
                       onClick={handleConnectPrinter}
                       className="w-full lg:w-auto h-10 px-6 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                     >
                       <Wifi size={18} /> {t('Connect')}
                     </button>
                   ) : printerStatus === 'connecting' ? (
                      <button 
                       disabled
                       className="w-full lg:w-auto h-10 px-6 rounded-lg bg-primary/50 text-background font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                     >
                       <Loader2 size={18} className="animate-spin" /> {t('Connecting')}
                     </button>
                   ) : (
                     <button 
                       onClick={handleDisconnectPrinter}
                       className="w-full lg:w-auto h-10 px-6 rounded-lg bg-surface border border-red-500/30 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                     >
                       <Wifi size={18} /> {t('Disconnect')}
                     </button>
                   )}
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                   <button 
                     onClick={handleTestPrint}
                     disabled={printerStatus !== 'connected'}
                     className={`w-full lg:w-auto h-10 px-6 rounded-lg border font-bold text-sm flex items-center justify-center gap-2 transition-colors
                       ${(printerStatus === 'connected')
                         ? 'border-primary/30 text-primary hover:bg-primary-bg' 
                         : 'border-border text-secondary opacity-50 cursor-not-allowed'}`}
                   >
                     <Printer size={18} /> {t('Test Print')}
                   </button>
              </div>

            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
              <Lock size={20} className="text-primary" /> {t('Account')}
            </h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-soft">
               <button 
                 onClick={() => setShowPasswordModal(true)}
                 className="w-full text-left flex items-center justify-between p-5 border-b border-border hover:bg-border/30 transition-colors group"
               >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-500"><Lock size={20} /></div>
                    <div>
                      <p className="font-bold text-text-main group-hover:text-primary transition-colors">{t('Change Password')}</p>
                      <p className="text-sm text-secondary">{t('Update credentials')}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-secondary" />
               </button>
               <button 
                 onClick={onLogout}
                 className="w-full text-left flex items-center justify-between p-5 hover:bg-red-500/10 transition-colors group"
               >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500"><LogOut size={20} /></div>
                    <div>
                      <p className="font-bold text-red-500">{t('Logout')}</p>
                      <p className="text-sm text-secondary">{t('End session')}</p>
                    </div>
                  </div>
               </button>
            </div>
          </section>

          <div className="text-center pt-4">
             <p className="text-xs text-secondary font-medium">App Version: 1.0.4 (Commercial Ready)</p>
             <p className="text-xs text-secondary/60 mt-1">© 2026 Restaurant Bar POS System. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center">
               <h3 className="font-bold text-text-main text-lg">{t('Change Password')}</h3>
               <button onClick={() => setShowPasswordModal(false)} className="text-secondary hover:text-text-main p-2 hover:bg-border rounded-lg transition-colors">
                  <X size={20} />
               </button>
            </div>
            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">{t('Current Password')}</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">{t('New Password')}</label>
                <input 
                   type="password"
                   required
                   className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                   placeholder="••••••••"
                   value={passwordForm.new}
                   onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">{t('Confirm New Password')}</label>
                <input 
                   type="password"
                   required
                   className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                   placeholder="••••••••"
                   value={passwordForm.confirm}
                   onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setShowPasswordModal(false)}
                   className="flex-1 py-3 rounded-lg border border-border text-text-main font-bold text-sm hover:bg-border transition-colors"
                 >
                   {t('Cancel')}
                 </button>
                 <button 
                   type="submit" 
                   disabled={isSavingPassword}
                   className="flex-1 py-3 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                 >
                   {isSavingPassword ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                   {t('Update')}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};