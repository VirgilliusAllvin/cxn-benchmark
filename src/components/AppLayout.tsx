import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '../contexts/AuthContext';
import { loadFromSupabase, isLoading } from '../lib/store';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const isGestor = profile.role === 'gestor';
    loadFromSupabase(isGestor).finally(() => setLoaded(true));
  }, [profile]);

  // Enquanto carrega os dados mostrar spinner
  if (!loaded && isLoading()) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-brand-gray">A carregar dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
