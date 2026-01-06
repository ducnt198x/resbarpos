import React, { useEffect, useState, useRef } from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Receipt, 
  Grid, 
  Package, 
  Settings, 
  LogOut,
  ChefHat,
  Upload,
  User,
  X,
  ShieldCheck,
  Save,
  Loader2,
  MoreHorizontal
} from 'lucide-react';
import { View } from '../types';
import { supabase } from '../supabase';
import { useTheme } from '../ThemeContext';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
}

interface NavItem {
  id: string;
  icon: any;
  label: string;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const { t } = useTheme();
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let userRole: 'admin' | 'staff' = 'staff';
        let displayName = user.user_metadata?.full_name || user.email; 
        let displayAvatar = user.user_metadata?.avatar_url 
            ? `${user.user_metadata.avatar_url}?t=${new Date().getTime()}` 
            : null;

        if (user.email === 'ducnt198x@gmail.com') {
            userRole = 'admin';
        }

        const { data: profile } = await supabase.from('users').select('role, avatar_url, full_name').eq('id', user.id).single();
        if (profile) {
            if (user.email !== 'ducnt198x@gmail.com') userRole = profile.role || 'staff';
            if (profile.full_name) displayName = profile.full_name;
            if (profile.avatar_url) displayAvatar = `${profile.avatar_url}?t=${new Date().getTime()}`;
        }
        setRole(userRole);
        setUserName(displayName || ''); 
        setAvatarUrl(displayAvatar);
      }
    };
    fetchUser();

    const fetchPendingOrders = async () => {
        const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'Pending'); 
        setPendingCount(count || 0);
    };
    fetchPendingOrders(); 

    const orderChannel = supabase.channel('sidebar-orders-counter').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchPendingOrders).subscribe();
    return () => { supabase.removeChannel(orderChannel); };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const handleSaveChanges = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, selectedFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        await supabase.from('users').upsert({ id: user.id, avatar_url: publicUrl, email: user.email, full_name: userName, role: role });
        await supabase.auth.refreshSession();
        setAvatarUrl(`${publicUrl}?t=${new Date().getTime()}`); setSelectedFile(null); setPreviewUrl(null); setShowProfileModal(false);
      }
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  };

  const handleCloseModal = () => { setShowProfileModal(false); setSelectedFile(null); setPreviewUrl(null); };

  // Reordered Navigation Items based on user priority
  const mainItems: NavItem[] = [
    ...(role === 'admin' ? [{ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' }] : []),
    { id: 'floorplan', icon: Grid, label: 'Tables' },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
    { id: 'orders', icon: Receipt, label: 'Orders', badge: pendingCount > 0 ? pendingCount : undefined },
    ...(role === 'admin' ? [{ id: 'inventory', icon: Package, label: 'Stock' }] : []),
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  // Secondary items are now empty as Inventory was moved up to Main
  const secondaryItems: NavItem[] = [];

  const handleMobileNavClick = (view: View) => { onChangeView(view); setShowMobileMoreMenu(false); }

  const renderIconNav = (item: NavItem, isMobile = false) => {
     const isActive = currentView === item.id;
     return (
        <button
          key={item.id}
          onClick={() => onChangeView(item.id as View)}
          className={
            isMobile 
              ? `flex flex-col items-center justify-center w-full h-full gap-1 active:scale-90 transition-transform relative ${isActive ? 'text-primary' : 'text-secondary'}`
              : `flex items-center gap-3 px-3 py-3 rounded-lg transition-all group w-full text-left relative ${isActive ? 'bg-primary/10 text-primary border-primary/20' : 'hover:bg-surface text-secondary hover:text-text-main'}`
          }
        >
          {isMobile ? (
             <div className={`relative p-1 rounded-xl ${isActive ? 'bg-primary/10' : ''}`}>
               <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
               {item.badge && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse border border-background">{item.badge}</span>}
             </div>
          ) : (
            <div className="relative">
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'} />
            </div>
          )}
          
          <span className={isMobile ? "text-[10px] font-medium" : `text-sm font-medium ${isActive ? 'font-bold' : ''}`}>
            {t(item.label)}
          </span>
          
          {!isMobile && item.badge && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-red-500/50">
               {item.badge}
            </span>
          )}
        </button>
     );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md border-t border-border flex justify-around items-center h-[70px] z-50 px-2 pb-safe lg:hidden transition-colors">
        {/* Only show first 4 items in mobile bottom bar, rest go to "More" */}
        {mainItems.slice(0, 4).map(item => renderIconNav(item, true))}
        
        <button 
          onClick={() => setShowMobileMoreMenu(true)} 
          className={`flex flex-col items-center justify-center w-full h-full gap-1 active:scale-90 transition-transform ${mainItems.slice(4).some(i => i.id === currentView) ? 'text-primary' : 'text-secondary'}`}
        >
          <div className="p-1">
             {avatarUrl ? (
               <img src={avatarUrl} className="w-6 h-6 rounded-full border border-current object-cover" />
             ) : (
               <MoreHorizontal size={24} />
             )}
          </div>
          <span className="text-[10px] font-medium">{t('More')}</span>
        </button>
      </nav>

      <aside className="hidden lg:flex w-64 bg-background border-r border-border flex-col h-full shrink-0 z-20 transition-colors">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-background shadow-lg shadow-primary/20">
              <ChefHat size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-text-main text-lg font-bold leading-tight">ResBar POS</h1>
              <p className="text-secondary text-xs font-medium">{t('Main Branch')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          {mainItems.map(item => renderIconNav(item, false))}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors cursor-pointer mb-2 group"
          >
            <div className="relative">
              <img 
                src={avatarUrl || "https://ui-avatars.com/api/?name=User&background=random"}
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-border object-cover group-hover:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-bold text-text-main truncate">{userName}</p>
              <p className="text-xs text-secondary capitalize">{role}</p>
            </div>
          </div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              onChangeView('login');
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">{t('Logout')}</span>
          </button>
        </div>
      </aside>

      {showMobileMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-200">
           <div className="w-full bg-surface rounded-t-2xl border-t border-border p-4 pb-8 space-y-2 animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-center mb-2">
                 <div className="w-12 h-1.5 bg-border rounded-full" />
              </div>
              
              <div className="flex items-center gap-3 p-3 mb-4 bg-background rounded-xl border border-border" onClick={() => setShowProfileModal(true)}>
                 <img src={avatarUrl || "https://ui-avatars.com/api/?name=User&background=random"} className="size-12 rounded-full object-cover border border-border" />
                 <div className="flex-1">
                    <h3 className="font-bold text-text-main text-lg">{userName}</h3>
                    <p className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit uppercase font-bold mt-1">{role}</p>
                 </div>
                 <Settings size={20} className="text-secondary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {mainItems.slice(4).map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleMobileNavClick(item.id as View)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all
                      ${currentView === item.id ? 'bg-primary text-background border-primary' : 'bg-background border-border text-text-main'}`}
                  >
                     <item.icon size={28} />
                     <span className="font-bold text-sm">{t(item.label)}</span>
                  </button>
                ))}
              </div>

              <button onClick={() => setShowMobileMoreMenu(false)} className="w-full py-3 text-secondary font-bold hover:text-text-main">
                Close Menu
              </button>
              
              <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    onChangeView('login');
                  }}
                  className="w-full py-3 mt-2 bg-red-500/10 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <LogOut size={18} /> {t('Logout')}
              </button>
           </div>
           <div className="absolute inset-0 -z-10" onClick={() => setShowMobileMoreMenu(false)}></div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl relative flex flex-col items-center p-6 lg:max-w-sm h-auto">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-secondary hover:text-text-main p-2"
            >
              <X size={24} />
            </button>
            
            <div className="size-32 rounded-full border-4 border-background shadow-xl mb-4 relative group overflow-hidden mt-4">
               <img 
                 src={previewUrl || avatarUrl || "https://ui-avatars.com/api/?name=User&background=random"} 
                 className="w-full h-full object-cover"
                 alt="User Avatar"
               />
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
               >
                  <Upload className="text-white" />
               </div>
            </div>
            
            <h2 className="text-xl font-bold text-text-main">{userName}</h2>
            <div className="flex items-center gap-2 mt-1 mb-6 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
               <ShieldCheck size={14} className="text-primary"/>
               <span className="text-xs font-bold text-primary uppercase">{role}</span>
            </div>

            <div className="w-full space-y-3">
               <div className="w-full p-3 bg-background rounded-xl border border-border flex items-center gap-3">
                  <User size={18} className="text-secondary"/>
                  <div className="overflow-hidden">
                     <p className="text-[10px] text-secondary uppercase font-bold">Full Name</p>
                     <p className="text-sm text-text-main font-bold truncate">{userName}</p>
                  </div>
               </div>
               
               {selectedFile ? (
                  <div className="flex gap-2">
                      <button 
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                          className="flex-1 py-3 bg-red-500/10 text-red-500 font-bold rounded-xl hover:bg-red-500/20 transition-colors"
                          disabled={isSaving}
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleSaveChanges}
                          disabled={isSaving}
                          className="flex-1 py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary-hover flex items-center justify-center gap-2 transition-colors"
                      >
                          {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                          Save
                      </button>
                  </div>
               ) : (
                  <>
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-3 bg-surface border border-border text-text-main font-bold rounded-xl hover:bg-border flex items-center justify-center gap-2 transition-colors"
                      >
                          <Upload size={18} /> Change Avatar
                      </button>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileSelect} 
                      />
                  </>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
