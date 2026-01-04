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
import { supabase } from './supabase';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('login');

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
    <div className="flex h-screen w-full bg-background text-white overflow-hidden">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <CurrencyProvider>
      <AppContent />
    </CurrencyProvider>
  );
}

export default App;