import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '../contexts/AuthContext';
import { loadFromSupabase } from '../lib/store';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, loading: authLoading } = useAuth();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Esperar que a auth termine de carregar
    if (authLoading) return;

    const isGestor = profile?.role === 'gestor';
    loadFromSupabase(isGestor)
      .then(() => setDataLoaded(true))
      .catch(err => {
        console.error('[AppLayout] Erro ao carregar dados:', err);
        setLoadError(true);
        setDataLoaded(true); // mesmo com erro, mostrar a app
      });
  }, [authLoading, profile]);

  if (!dataLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-brand-gray">A carregar dados...</span>
          {loadError && (
            <span className="text-xs text-red-500 mt-1">Erro de ligação. Verifica as credenciais Supabase.</span>
          )}
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
