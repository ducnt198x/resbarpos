
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { SETTINGS_STORAGE_KEY } from './services/SettingsService';
import { DemoService, DemoRole } from './services/DemoService';

type UserRole = 'admin' | 'manager' | 'staff';

interface AuthContextType {
  user: any;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;

  // Demo / Trial
  isDemo: boolean;
  demoRole: DemoRole | null;
  signInDemo: (role: DemoRole) => Promise<void>;
  
  // Lock Screen functionality
  isLocked: boolean;
  lockApp: () => void;
  unlockApp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage for zero-lag UI
  const [user, setUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('auth_user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) { 
      return null; 
    }
  });

  // Default to 'staff' if unknown, but prioritize local storage
  const [role, setRole] = useState<UserRole>(() => {
    const cached = localStorage.getItem('auth_role');
    return (cached === 'admin' || cached === 'manager' || cached === 'staff') ? cached : 'staff';
  });
  
  const [loading, setLoading] = useState(!user);
  const [isLocked, setIsLocked] = useState(false);
  const [isDemo, setIsDemo] = useState<boolean>(() => DemoService.isDemo());
  const [demoRole, setDemoRole] = useState<DemoRole | null>(() => DemoService.getRole());

  const buildDemoUser = (r: DemoRole): any => {
    const deviceId = (() => {
      try { return localStorage.getItem('resbar_device_id') || 'local'; } catch { return 'local'; }
    })();
    return {
      id: `DEMO_${deviceId}`,
      email: `demo+${r}@nepos.local`,
      user_metadata: {
        full_name: 'Trial User',
        role: r,
        is_demo: true
      },
      app_metadata: {
        role: r,
        is_demo: true
      }
    };
  };

  /**
   * Clears ONLY auth-related keys from storage.
   * Explicitly preserves Settings and other app data.
   */
  const clearAuth = () => {
    console.log("🧹 Clearing Auth State & Storage...");
    setUser(null);
    setRole('staff');
    setIsLocked(false);
    
    // 1. Keys to always remove
    const keysToRemove = [
        'auth_user', 
        'auth_role', 
        'sb-resbar-pos-token', // Matches supabase.ts config
        'sb-ddtcrhmpuwkrykopcdgy-auth-token' // Legacy/Default fallback
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 2. Scan and remove Supabase patterns (sb-*)
    // SAFEGUARD: Do NOT remove Settings
    try {
        Object.keys(localStorage).forEach((key) => {
            // PROTECT: Skip Settings Keys
            if (key.startsWith(SETTINGS_STORAGE_KEY)) {
                return;
            }

            // DELETE: Supabase Auth Tokens or internal auth keys
            if (key.startsWith('sb-') || key.startsWith('supabase.')) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn("Error cleaning storage:", e);
    }
  };

  const determineRole = (userData: any): UserRole => {
    if (!userData) return 'staff';
    const metaRole = userData.user_metadata?.role?.toLowerCase();
    const appRole = userData.app_metadata?.role?.toLowerCase();
    
    // Normalize logic
    if (metaRole === 'admin' || appRole === 'admin' || userData.email?.includes('admin')) return 'admin';
    if (metaRole === 'manager' || appRole === 'manager') return 'manager';
    return 'staff';
  };

  const handleUserUpdate = async (userData: any) => {
    if (!userData) return;
    setUser(userData);
    
    const newRole = determineRole(userData);
    setRole(newRole);
    
    localStorage.setItem('auth_user', JSON.stringify(userData));
    localStorage.setItem('auth_role', newRole);
    setLoading(false);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // DEMO SHORT-CIRCUIT: no Supabase session needed
        if (DemoService.isDemo()) {
          setIsDemo(true);
          setDemoRole(DemoService.getRole());
          // enforce expiry on boot
          const res = await DemoService.enforceLifecycle();
          if (res.wiped) {
            clearAuth();
            return;
          }

          // Restore demo user from cache if needed
          const cached = localStorage.getItem('auth_user');
          if (cached) {
            try {
              const demoUser = JSON.parse(cached);
              setUser(demoUser);
              const cachedRole = localStorage.getItem('auth_role') as UserRole | null;
              if (cachedRole === 'admin' || cachedRole === 'manager' || cachedRole === 'staff') {
                setRole(cachedRole);
              }
              setLoading(false);
              return;
            } catch {
              // continue to create a new demo user
            }
          }

          // Create minimal demo user object
          const r = DemoService.getRole() || 'staff';
          const demoUser = buildDemoUser(r);
          setUser(demoUser);
          setRole(r as UserRole);
          localStorage.setItem('auth_user', JSON.stringify(demoUser));
          localStorage.setItem('auth_role', r);
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid refresh token')) {
            console.error("🔥 Critical Auth Error: Invalid refresh token. Purging state.");
            clearAuth();
          }
          throw error;
        }

        if (session) {
          await handleUserUpdate(session.user);
        } else {
          if (navigator.onLine) clearAuth();
        }
      } catch (e) {
        console.warn("Auth initialization warning:", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔑 Auth Event: ${event}`);
      if (session) {
        await handleUserUpdate(session.user);
      } else if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        clearAuth();
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) handleUserUpdate(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInDemo = async (r: DemoRole) => {
    await DemoService.startDemo(r);
    setIsDemo(true);
    setDemoRole(r);

    const demoUser = buildDemoUser(r);
    setUser(demoUser);
    setRole(r as UserRole);
    localStorage.setItem('auth_user', JSON.stringify(demoUser));
    localStorage.setItem('auth_role', r);
    setLoading(false);
  };

  const signOut = async () => {
    try {
      const u = user;
      clearAuth();
      // Demo: also wipe demo flags (keeps Settings safe per requirement)
      if (DemoService.isDemo()) {
        await DemoService.wipeAllDemoData();
        setIsDemo(false);
        setDemoRole(null);
        return;
      }
      if (u && navigator.onLine) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  const lockApp = () => setIsLocked(true);
  const unlockApp = () => setIsLocked(false);

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut, isDemo, demoRole, signInDemo, isLocked, lockApp, unlockApp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
