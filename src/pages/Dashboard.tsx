import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend, Cell,
} from 'recharts';
import { Trophy, TrendingUp, Building2, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSnapshot } from '../lib/store';
import { DIMENSIONS } from '../lib/data';
import { dimensionScore, marketDimensionAvg, rankBanks } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';
import { Score100Badge } from '../components/ScoreBadge';

const RADAR_COLORS = ['#1818db', '#1ddbb1', '#f59e0b', '#494949'];

// Cor de score 0-100
function sc(v: number) {
  if (v >= 80) return '#1ddbb1';
  if (v >= 60) return '#22c55e';
  if (v >= 40) return '#eab308';
  if (v >  0) return '#ef4444';
  return '#d1d5db';
}

export function Dashboard() {
  const state = useSnapshot();

  const bankList = state.bankList;

  // Dashboard e Ranking apenas com avaliações aprovadas
  const allBanks = useMemo(() =>
    bankList
      .map(b => ({ id: b.id, data: state.banks[b.id] }))
      .filter(b => b.data && b.data.status === 'approved'),
    [state]);

  const ranked   = useMemo(() => rankBanks(allBanks, state.dimensionWeights), [allBanks, state.dimensionWeights]);
  const evaluated = ranked.filter(b => b.score > 0);

  const leader      = ranked[0];
  const leaderBank  = bankList.find(b => b.id === leader?.id);
  const marketAvg   = evaluated.length
    ? Math.round(evaluated.reduce((s, b) => s + b.score, 0) / evaluated.length * 10) / 10
    : 0;
  const below50     = ranked.filter(b => b.score > 0 && b.score < 50).length;
  const completedCt = Object.values(state.banks).filter(b => b.status === 'approved').length;

  const barData = useMemo(() =>
    ranked.filter(b => b.score > 0).map(b => ({
      name:  bankList.find(bk => bk.id === b.id)?.shortName ?? b.id,
      score: b.score,
    })), [ranked, bankList]);

  const top4 = ranked.slice(0, 4);
  const radarData = useMemo(() =>
    DIMENSIONS.map(dim => {
      const entry: Record<string, string | number> = { dim: dim.shortName };
      top4.forEach(b => {
        const bk = bankList.find(bk => bk.id === b.id);
        entry[bk?.shortName ?? b.id] = Math.round(dimensionScore(b.data, dim.id) * 20 * 10) / 10;
      });
      return entry;
    }), [top4, bankList]);

  const dimAvgs = useMemo(() =>
    DIMENSIONS.map(d => ({
      dim: d,
      avg: Math.round(marketDimensionAvg(evaluated.map(b => b.data), d.id) * 20 * 10) / 10,
    })).sort((a, b) => b.avg - a.avg), [evaluated]);

  const gaps  = [...dimAvgs].sort((a, b) => a.avg - b.avg).slice(0, 3);
  const bests = [...dimAvgs].sort((a, b) => b.avg - a.avg).slice(0, 3);

  const KPI_CARDS = [
    { label: 'Líder de Mercado', value: leaderBank?.shortName ?? '—', sub: leader ? `Score ${leader.score.toFixed(1)}` : '', icon: Trophy,         accent: '#1818db' },
    { label: 'Média do Mercado', value: `${marketAvg}`,               sub: 'Escala 0–100',                                   icon: TrendingUp,     accent: '#1ddbb1' },
    { label: 'Bancos Avaliados', value: `${completedCt}`,             sub: `de ${bankList.length} bancos`,                   icon: Building2,      accent: '#494949' },
    { label: 'Abaixo de 50',     value: `${below50}`,                 sub: 'Bancos em risco',                                icon: AlertTriangle,  accent: '#f59e0b' },
  ];

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do benchmarking da banca digital em Angola"
      />

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {KPI_CARDS.map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="bg-white rounded-xl shadow-card border border-gray-100"
            style={{ padding: '20px 22px' }}>
            {/* icon */}
            <div style={{ width: 34, height: 34, borderRadius: 8, background: accent + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            {/* value */}
            <div style={{ fontSize: 28, fontWeight: 800, color: '#161616', letterSpacing: '-0.035em', lineHeight: 1, marginBottom: 6 }}>
              {value}
            </div>
            {/* sub */}
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{sub}</div>
            {/* label */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#494949', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-7">

        {/* Ranking bar */}
        <div className="lg:col-span-3 bg-white rounded-xl p-6 shadow-card border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em' }}>
              Ranking Geral
            </span>
            <Link to="/ranking" style={{ fontSize: 12, color: '#1818db', display: 'flex', alignItems: 'center', gap: 3 }}>
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>

          {barData.length === 0
            ? <div className="flex items-center justify-center h-52 text-brand-gray text-sm">Sem dados</div>
            : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#494949', fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(1)}`, 'Score']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'Plus Jakarta Sans' }}
                  />
                  <Bar dataKey="score" radius={[0, 5, 5, 0]} maxBarSize={16}>
                    {barData.map((entry, i) => <Cell key={i} fill={sc(entry.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Radar top 4 */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-card border border-gray-100">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em', display: 'block', marginBottom: 16 }}>
            Top 4 — Perfil Comparativo
          </span>
          {top4.length === 0
            ? <div className="flex items-center justify-center h-52 text-brand-gray text-sm">Sem dados</div>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 8, right: 18, bottom: 8, left: 18 }}>
                  <PolarGrid stroke="#f0f0f0" />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 9, fill: '#494949', fontFamily: 'Plus Jakarta Sans' }} />
                  {top4.map((b, i) => {
                    const bk = bankList.find(bk => bk.id === b.id);
                    return (
                      <Radar key={b.id} name={bk?.shortName ?? b.id}
                        dataKey={bk?.shortName ?? b.id}
                        stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.07} strokeWidth={1.5} />
                    );
                  })}
                  <Legend iconSize={7} wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* ── Insights ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">

        {/* Médias por dimensão */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-gray-100">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em', display: 'block', marginBottom: 16 }}>
            Média por Dimensão
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dimAvgs.map(({ dim, avg }) => (
              <div key={dim.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#494949', width: 20 }}>{dim.id}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#494949', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dim.shortName}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc(avg) }}>{avg.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${avg}%`, background: sc(avg), borderRadius: 2, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Gaps */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-gray-100">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em', display: 'block' }}>Top Gaps do Mercado</span>
          <span style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 20, marginTop: 2 }}>Dimensões com pior desempenho médio</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {gaps.map(({ dim, avg }, i) => (
              <div key={dim.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#161616' }}>{dim.name}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    Média: <span style={{ fontWeight: 700, color: '#ef4444' }}>{avg.toFixed(0)}/100</span>
                  </div>
                </div>
              </div>
            ))}
            {gaps.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sem dados suficientes</span>}
          </div>
        </div>

        {/* Boas Práticas */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-gray-100">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em', display: 'block' }}>Boas Práticas</span>
          <span style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 20, marginTop: 2 }}>Dimensões com melhor desempenho médio</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bests.map(({ dim, avg }, i) => (
              <div key={dim.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1ddbb1' }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#161616' }}>{dim.name}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    Média: <span style={{ fontWeight: 700, color: '#1ddbb1' }}>{avg.toFixed(0)}/100</span>
                  </div>
                </div>
              </div>
            ))}
            {bests.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sem dados suficientes</span>}
          </div>
        </div>
      </div>

      {/* ── Ranking table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', letterSpacing: '-0.01em' }}>
            Ranking Detalhado
          </span>
          <Link to="/ranking" style={{ fontSize: 12, color: '#1818db', display: 'flex', alignItems: 'center', gap: 3 }}>
            Ver completo <ChevronRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                <th className="text-left px-6 py-3" style={{ color: '#999', fontWeight: 600, fontSize: 11 }}>#</th>
                <th className="text-left px-4 py-3" style={{ color: '#999', fontWeight: 600, fontSize: 11 }}>Banco</th>
                {DIMENSIONS.map(d => (
                  <th key={d.id} className="text-center px-2 py-3" style={{ color: '#999', fontWeight: 600, fontSize: 10 }}>{d.id}</th>
                ))}
                <th className="text-right px-6 py-3" style={{ color: '#999', fontWeight: 600, fontSize: 11 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {ranked.filter(b => b.score > 0).slice(0, 8).map(b => {
                const bank = bankList.find(bk => bk.id === b.id);
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-6 py-3" style={{ fontWeight: 700, color: '#494949' }}>{b.rank}</td>
                    <td className="px-4 py-3">
                      <Link to={`/banks/${b.id}`} style={{ fontWeight: 600, color: '#161616', fontSize: 12 }}
                        onMouseEnter={e => ((e.target as HTMLElement).style.color = '#1818db')}
                        onMouseLeave={e => ((e.target as HTMLElement).style.color = '#161616')}>
                        {bank?.shortName}
                      </Link>
                    </td>
                    {DIMENSIONS.map(d => {
                      const ds = Math.round(dimensionScore(b.data, d.id) * 20);
                      return (
                        <td key={d.id} className="px-2 py-3 text-center" style={{ fontWeight: 600, color: sc(ds) }}>
                          {ds > 0 ? ds : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      );
                    })}
                    <td className="px-6 py-3 text-right">
                      <Score100Badge score={b.score} size="sm" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
