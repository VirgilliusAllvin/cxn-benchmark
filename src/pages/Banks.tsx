import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Image as ImageIcon, Calendar, ClipboardList } from 'lucide-react';
import { useSnapshot } from '../lib/store';
import { rankBanks, evidenceCount } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';
import { Score100Badge } from '../components/ScoreBadge';
import { useAuth } from '../contexts/AuthContext';
import type { EvaluationStatus } from '../lib/types';

type Filter = 'all' | EvaluationStatus;

const STATUS_STYLES: Record<EvaluationStatus, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Rascunho',   bg: 'bg-gray-100',  text: 'text-gray-500' },
  submitted: { label: 'Em revisão', bg: 'bg-amber-50',  text: 'text-amber-600' },
  approved:  { label: 'Aprovada',   bg: 'bg-green-50',  text: 'text-green-600' },
  rejected:  { label: 'Rejeitada',  bg: 'bg-red-50',    text: 'text-red-600' },
};

export function Banks() {
  const state = useSnapshot();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const bankList = state.bankList;
  const isAgente = profile?.role === 'agente';

  const allBanks = useMemo(
    () => bankList.map(b => ({ id: b.id, data: state.banks[b.id] })).filter(b => b.data),
    [state],
  );
  const ranked = useMemo(() => rankBanks(allBanks, state.dimensionWeights), [allBanks, state.dimensionWeights]);

  const filtered = useMemo(() => {
    return ranked.filter(b => {
      const bank = bankList.find(bk => bk.id === b.id)!;
      const matchQ = query === '' ||
        bank.shortName.toLowerCase().includes(query.toLowerCase()) ||
        bank.name.toLowerCase().includes(query.toLowerCase());
      const matchF = filter === 'all' || state.banks[b.id]?.status === filter;
      return matchQ && matchF;
    });
  }, [ranked, query, filter, state, bankList]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',       label: 'Todos' },
    { key: 'draft',     label: 'Rascunho' },
    { key: 'submitted', label: 'Em revisão' },
    { key: 'approved',  label: 'Aprovados' },
    { key: 'rejected',  label: 'Rejeitados' },
  ];

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Bancos"
        subtitle={`${bankList.length} banco${bankList.length !== 1 ? 's' : ''} em análise`}
        actions={
          isAgente && (
            <Link
              to="/avaliacao"
              className="flex items-center gap-2 text-sm bg-brand-blue text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              + Nova Avaliação
            </Link>
          )
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray" />
          <input
            type="text"
            placeholder="Pesquisar banco..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === f.key ? 'bg-brand-blue text-white' : 'text-brand-dark hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-brand-gray">{filtered.length} banco{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map(b => {
          const bank = bankList.find(bk => bk.id === b.id)!;
          const bData = state.banks[b.id];
          const evCount = bData ? evidenceCount(bData) : 0;
          const updated = bData?.updatedAt
            ? new Date(bData.updatedAt).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })
            : '—';
          const statusKey = (bData?.status ?? 'draft') as EvaluationStatus;
          const statusStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES.draft;

          return (
            <div key={b.id} className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-card-hover hover:border-brand-blue/20 transition-all group flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: '#1818db' }}>
                  {bank.shortName.charAt(0)}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
              </div>

              {/* Name */}
              <div className="mb-1">
                <div className="text-sm font-bold text-brand-black">{bank.shortName}</div>
                <div className="text-xs text-brand-gray truncate">{bank.name}</div>
              </div>

              {/* Score */}
              <div className="my-3">
                {b.score > 0 ? (
                  <div className="flex items-center gap-2">
                    <Score100Badge score={b.score} size="lg" />
                    <div className="text-xs text-brand-gray">#{b.rank}</div>
                  </div>
                ) : (
                  <div className="text-xs text-brand-gray italic">Sem score ainda</div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-brand-gray">
                <div className="flex items-center gap-1">
                  <ImageIcon size={10} />
                  <span>{evCount} evidência{evCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={10} />
                  <span>{updated}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <Link
                  to={`/banks/${b.id}`}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-brand-blue font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Ver detalhe <ChevronRight size={11} />
                </Link>
                {isAgente && (
                  <Link
                    to={`/avaliacao?bank=${b.id}`}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-white font-medium py-1.5 rounded-lg transition-colors"
                    style={{ background: '#1818db' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1212b0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#1818db')}
                  >
                    <ClipboardList size={11} /> Avaliar
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
