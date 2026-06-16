import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '../contexts/AuthContext';
import { loadFromSupabase } from '../lib/store';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
      {/* Sidebar desktop (estática) */}
      <div className="hidden md:flex">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Drawer móvel */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50 shadow-2xl">
            <AppSidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Coluna de conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barra superior móvel */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 shrink-0"
          style={{ background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 26, height: 26, background: '#1818db' }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '-0.04em' }}>CX</span>
            </div>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>CX Angola</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
