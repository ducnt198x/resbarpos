import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './screens/Dashboard';
import { Menu } from './screens/Menu';
import { FloorPlan } from './screens/FloorPlan';
import { Inventory } from './screens/Inventory';
import { Settings } from './screens/Settings';
import { Login } from './screens/Login';
import { Orders } from './screens/Orders';
import { View } from './types';
import { CurrencyProvider } from './CurrencyContext';
import { ThemeProvider, useTheme } from './ThemeContext'; // Import useTheme
import { supabase } from './supabase';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('login');
  const { brightness } = useTheme(); // Get brightness from context

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentView('dashboard');
      }
    });

    // Listen for auth state changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'menu':
        return <Menu />;
      case 'floorplan':
        return <FloorPlan />;
      case 'orders':
         return <Orders />;
      case 'inventory':
        return <Inventory />;
      case 'settings':
        return <Settings onLogout={() => setCurrentView('login')} />;
      default:
        return <Dashboard />;
    }
  };

  if (currentView === 'login') {
    return <Login onLogin={() => setCurrentView('dashboard')} />;
  }

  return (
    // FIX LAYOUT:
    // Mobile/Tablet (< 1024px): flex-col. The Sidebar component renders a FIXED bottom bar.
    // Desktop (>= 1024px): flex-row. The Sidebar component renders a STATIC left sidebar.
    <div className="flex flex-col lg:flex-row h-screen w-full bg-background text-text-main overflow-hidden relative">
      
      {/* Simulating Screen Brightness via Overlay */}
      <div 
        className="fixed inset-0 z-[9999] bg-black pointer-events-none transition-opacity duration-300"
        style={{ opacity: (100 - brightness) / 100 }}
      />

      {/* Sidebar handles strictly mutually exclusive rendering internally */}
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      {/* 
         PADDING LOGIC:
         - pb-[70px]: DEFAULT for Mobile/Tablet (< lg) to account for the Fixed Bottom Bar.
         - lg:pb-0: On Desktop, remove bottom padding because there is no bottom bar.
      */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pb-[70px] lg:pb-0 w-full transition-all duration-300">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <AppContent />
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;