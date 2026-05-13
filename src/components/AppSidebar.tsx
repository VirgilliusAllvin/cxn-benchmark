import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Layers, TrendingUp,
  ClipboardList, Image, Download, X, Menu, Settings,
  ClipboardCheck, LogOut, User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  gestorOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/banks',          icon: Building2,       label: 'Bancos' },
  { to: '/dimensoes',      icon: Layers,          label: 'Dimensões' },
  { to: '/ranking',        icon: TrendingUp,      label: 'Ranking' },
  { to: '/avaliacao',      icon: ClipboardList,   label: 'Avaliação' },
  { to: '/evidencias',     icon: Image,           label: 'Evidências' },
  { to: '/exportar',       icon: Download,        label: 'Exportar' },
  { to: '/revisao',        icon: ClipboardCheck,  label: 'Revisão',   gestorOnly: true },
  { to: '/configuracoes',  icon: Settings,        label: 'Configurações', gestorOnly: true },
];

const ROLE_LABELS: Record<string, string> = {
  gestor: 'Gestor',
  agente: 'Agente',
};

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: Props) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();

  const visibleNav = NAV.filter(item =>
    !item.gestorOnly || profile?.role === 'gestor'
  );

  return (
    <aside
      className="h-screen flex flex-col shrink-0 transition-all duration-250"
      style={{
        width: collapsed ? 60 : 216,
        background: '#161616',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{ width: 32, height: 32, background: '#1818db' }}
        >
          <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 800, letterSpacing: '-0.04em', fontFamily: 'inherit' }}>
            CX
          </span>
        </div>

        {!collapsed && (
          <div className="overflow-hidden flex-1 min-w-0">
            <div style={{ color: '#ffffff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              CX Angola
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 400, marginTop: 1 }}>
              Benchmark Digital
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className="shrink-0 rounded-md flex items-center justify-center transition-colors"
          style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <Menu size={14} /> : <X size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto" style={{ padding: '12px 8px' }}>
        {visibleNav.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className="flex items-center rounded-lg mb-0.5 transition-all"
              style={{
                gap: 10,
                padding: collapsed ? '9px 0' : '9px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? '#1818db' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.42)',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'; }}
            >
              <Icon size={15} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {!collapsed && profile && (
          <div className="px-4 py-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <User size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{profile.name}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {ROLE_LABELS[profile.role] ?? profile.role}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: collapsed ? '8px 0' : '4px 8px 12px' }}>
          <button
            onClick={signOut}
            title="Terminar sessão"
            className="w-full flex items-center rounded-lg transition-all"
            style={{
              gap: 10,
              padding: collapsed ? '9px 0' : '9px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'rgba(255,255,255,0.30)',
              fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && <span>Terminar sessão</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
