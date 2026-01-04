import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Printer, Wifi, Lock, LogOut, ChevronRight, Save, X, Check, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { supabase } from '../supabase';
import { printTestTicket } from '../utils/printService';

interface SettingsProps {
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  // Global Currency State
  const { currency, setCurrency } = useCurrency();

  // General State
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<'en' | 'vi'>('en');
  
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

  // Effect for dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

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
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
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
           <h1 className="text-white text-2xl font-bold tracking-tight">Settings</h1>
           <p className="text-secondary text-sm mt-1">Manage system configuration, devices, and account</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">
          
          {/* General */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <SettingsIcon size={20} className="text-primary" /> General
            </h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {/* Language */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><Globe size={20} /></div>
                  <div>
                    <p className="font-bold text-white">Language</p>
                    <p className="text-sm text-secondary">Choose display language</p>
                  </div>
                </div>
                <div className="bg-background p-1 rounded-lg flex border border-border">
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'en' ? 'bg-surface text-white shadow-sm' : 'text-secondary hover:text-white'}`}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'vi' ? 'bg-surface text-white shadow-sm' : 'text-secondary hover:text-white'}`}
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
                    <p className="font-bold text-white">Currency</p>
                    <p className="text-sm text-secondary">Select preferred currency unit</p>
                  </div>
                </div>
                <div className="bg-background p-1 rounded-lg flex border border-border">
                  <button 
                    onClick={() => setCurrency('VND')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === 'VND' ? 'bg-surface text-white shadow-sm' : 'text-secondary hover:text-white'}`}
                  >
                    VNĐ (₫)
                  </button>
                  <button 
                    onClick={() => setCurrency('USD')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currency === 'USD' ? 'bg-surface text-white shadow-sm' : 'text-secondary hover:text-white'}`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              {/* Dark Mode */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500"><Moon size={20} /></div>
                  <div>
                    <p className="font-bold text-white">Dark Mode</p>
                    <p className="text-sm text-secondary">Adjust appearance interface</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Hardware */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Printer size={20} className="text-primary" /> Hardware & Devices
            </h2>
            <div className="bg-surface rounded-xl border border-border p-6 space-y-6">
              
              {/* Network Printer */}
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`size-10 rounded-full flex items-center justify-center transition-colors 
                      ${printerStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      <Wifi size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Network Printer (LAN/WiFi)</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`flex size-2 rounded-full ${printerStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></span>
                        <span className={`text-sm font-bold ${printerStatus === 'connected' ? 'text-green-500' : 'text-orange-500'}`}>
                          {printerStatus === 'connected' ? 'Connected' : printerStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-secondary">Printer Name</label>
                      <input 
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none" 
                        value={printerConfig.name}
                        onChange={(e) => setPrinterConfig({...printerConfig, name: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-secondary">IP Address</label>
                      <input 
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none" 
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
                       <Wifi size={18} /> Connect
                     </button>
                   ) : printerStatus === 'connecting' ? (
                      <button 
                       disabled
                       className="w-full lg:w-auto h-10 px-6 rounded-lg bg-primary/50 text-background font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                     >
                       <Loader2 size={18} className="animate-spin" /> Connecting
                     </button>
                   ) : (
                     <button 
                       onClick={handleDisconnectPrinter}
                       className="w-full lg:w-auto h-10 px-6 rounded-lg bg-surface border border-red-500/30 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                     >
                       <Wifi size={18} /> Disconnect
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
                         ? 'border-primary/30 text-primary hover:bg-primary/10' 
                         : 'border-border text-secondary opacity-50 cursor-not-allowed'}`}
                   >
                     <Printer size={18} /> Test Print
                   </button>
              </div>

            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Lock size={20} className="text-primary" /> Account
            </h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
               <button 
                 onClick={() => setShowPasswordModal(true)}
                 className="w-full text-left flex items-center justify-between p-5 border-b border-border hover:bg-border/30 transition-colors group"
               >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300"><Lock size={20} /></div>
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">Change Password</p>
                      <p className="text-sm text-secondary">Update your login credentials</p>
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
                      <p className="font-bold text-red-500">Logout</p>
                      <p className="text-sm text-secondary">End current session</p>
                    </div>
                  </div>
               </button>
            </div>
          </section>

          <div className="text-center pt-4">
             <p className="text-xs text-secondary font-medium">App Version: 1.0.3 (Build 20231026)</p>
             <p className="text-xs text-secondary/60 mt-1">© 2024 Restaurant POS System. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center">
               <h3 className="font-bold text-white text-lg">Change Password</h3>
               <button onClick={() => setShowPasswordModal(false)} className="text-secondary hover:text-white p-2 hover:bg-border rounded-lg transition-colors">
                  <X size={20} />
               </button>
            </div>
            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">Current Password</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  placeholder="••••••••"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">New Password</label>
                <input 
                   type="password"
                   required
                   className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                   placeholder="••••••••"
                   value={passwordForm.new}
                   onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase">Confirm New Password</label>
                <input 
                   type="password"
                   required
                   className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                   placeholder="••••••••"
                   value={passwordForm.confirm}
                   onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setShowPasswordModal(false)}
                   className="flex-1 py-3 rounded-lg border border-border text-white font-bold text-sm hover:bg-border transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit" 
                   disabled={isSavingPassword}
                   className="flex-1 py-3 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                 >
                   {isSavingPassword ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                   Update
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
