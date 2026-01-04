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
  Loader2
} from 'lucide-react';
import { View } from '../types';
import { supabase } from '../supabase';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [userName, setUserName] = useState('Staff');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Avatar Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 1. Fetch User Profile
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === 'ducnt198x@gmail.com') {
            setRole('admin');
        } else {
            const { data: profile } = await supabase
                .from('users')
                .select('role, avatar_url, full_name')
                .eq('id', user.id)
                .single();
            
            if (profile) {
                setRole(profile.role || 'staff');
                setAvatarUrl(profile.avatar_url);
                setUserName(profile.full_name || user.user_metadata?.full_name || 'Staff');
            } else {
                setRole(user.user_metadata?.role || 'staff');
                setUserName(user.user_metadata?.full_name || 'Staff');
            }
        }
      }
    };
    fetchUser();

    // 2. Fetch Initial Pending Count & Subscribe
    const fetchPendingOrders = async () => {
        // Badge counts ONLY 'Pending' orders (Kitchen notification)
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Pending'); 
        setPendingCount(count || 0);
    };
    
    fetchPendingOrders(); // Initial load

    // 3. Realtime Subscription for Orders
    // Listens for ALL events (INSERT, UPDATE, DELETE) to ensure count is accurate
    // e.g. New Order (Insert), Status Change (Update), Deleted Order (Delete)
    const orderChannel = supabase
      .channel('sidebar-orders-counter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPendingOrders();
      })
      .subscribe();

    return () => {
        supabase.removeChannel(orderChannel);
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedFile) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${user.id}-${Date.now()}.${fileExt}`;

        // Attempt Upload
        let { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, selectedFile, { upsert: true });

        // FIX: If bucket not found, try to create it (if permissions allow)
        if (uploadError && (uploadError.message.includes('Bucket not found') || (uploadError as any).statusCode === '404')) {
            console.log("Bucket 'avatars' not found. Attempting to create...");
            const { error: createError } = await supabase.storage.createBucket('avatars', { 
                public: true,
                allowedMimeTypes: ['image/*'],
                fileSizeLimit: 2097152 // 2MB
            });

            if (!createError) {
                // Retry upload if creation succeeded
                const { error: retryError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, selectedFile, { upsert: true });
                uploadError = retryError;
            }
        }

        if (uploadError) {
             if (uploadError.message.includes('Bucket not found')) {
                 throw new Error("Storage bucket 'avatars' is missing. Please create a public bucket named 'avatars' in your Supabase project dashboard.");
             }
             throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const { error: dbError } = await supabase
            .from('users')
            .upsert({ id: user.id, avatar_url: publicUrl });
        
        if (dbError) throw dbError;

        setAvatarUrl(publicUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
        setShowProfileModal(false);
      }
    } catch (error: any) {
      console.error("Avatar upload failed:", error);
      alert("Failed to update profile: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
      setShowProfileModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'floorplan', icon: Grid, label: 'Floor Plan' },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
    { id: 'orders', icon: Receipt, label: 'Orders', badge: pendingCount > 0 ? pendingCount : undefined },
    ...(role === 'admin' ? [
      { id: 'inventory', icon: Package, label: 'Inventory' },
      { id: 'settings', icon: Settings, label: 'Settings' }
    ] : [])
  ];

  return (
    <>
    <aside className="w-64 bg-background border-r border-border flex flex-col h-full shrink-0 z-20">
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-background">
            <ChefHat size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-tight">Respo POS</h1>
            <p className="text-secondary text-xs font-medium">Main Branch</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 flex flex-col gap-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as View)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all group w-full text-left relative
                ${isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'hover:bg-surface text-secondary hover:text-white'
                }`}
            >
              <item.icon 
                size={22} 
                className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-sm font-medium ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-red-500/50">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
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
            <p className="text-sm font-bold text-white truncate">{userName}</p>
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
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>

    {/* User Profile Modal */}
    {showProfileModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl relative flex flex-col items-center p-6">
          <button 
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-secondary hover:text-white"
          >
            <X size={20} />
          </button>
          
          <div className="size-32 rounded-full border-4 border-background shadow-xl mb-4 relative group overflow-hidden">
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
          
          <h2 className="text-xl font-bold text-white">{userName}</h2>
          <div className="flex items-center gap-2 mt-1 mb-6 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
             <ShieldCheck size={14} className="text-primary"/>
             <span className="text-xs font-bold text-primary uppercase">{role}</span>
          </div>

          <div className="w-full space-y-3">
             <div className="w-full p-3 bg-background rounded-xl border border-border flex items-center gap-3">
                <User size={18} className="text-secondary"/>
                <div className="overflow-hidden">
                   <p className="text-[10px] text-secondary uppercase font-bold">Full Name</p>
                   <p className="text-sm text-white font-bold truncate">{userName}</p>
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
                        Save Changes
                    </button>
                </div>
             ) : (
                <>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-surface border border-border text-white font-bold rounded-xl hover:bg-border flex items-center justify-center gap-2 transition-colors"
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