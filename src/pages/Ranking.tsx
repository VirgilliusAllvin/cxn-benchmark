import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Award, ChevronRight } from 'lucide-react';
import { useSnapshot } from '../lib/store';
import { rankBanks } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';
import { Score100Badge } from '../components/ScoreBadge';

export function Ranking() {
  const state = useSnapshot();
  const bankList = state.bankList;

  // Apenas avaliações aprovadas entram no ranking
  const allBanks = useMemo(
    () => bankList
      .map(b => ({ id: b.id, data: state.banks[b.id] }))
      .filter(b => b.data && b.data.status === 'approved'),
    [state],
  );
  const ranked = useMemo(() => rankBanks(allBanks, state.dimensionWeights), [allBanks, state.dimensionWeights]);
  const withScores = ranked.filter(b => b.score > 0);

  const podium = withScores.slice(0, 3);

  const PODIUM_CONFIG = [
    { pos: 2, icon: Medal,  color: '#94a3b8', bgColor: '#f8fafc', iconSize: 20, scale: 'scale-95' },
    { pos: 1, icon: Trophy, color: '#f59e0b', bgColor: '#fffbeb', iconSize: 24, scale: 'scale-100' },
    { pos: 3, icon: Award,  color: '#cd7c3f', bgColor: '#fef3eb', iconSize: 18, scale: 'scale-90' },
  ];

  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Ranking Geral"
        subtitle={`${withScores.length} banco${withScores.length !== 1 ? 's' : ''} aprovado${withScores.length !== 1 ? 's' : ''} de ${bankList.length} no total`}
      />

      {withScores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <Trophy size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhuma avaliação aprovada ainda.</p>
          <p className="text-xs mt-1">O ranking é calculado com base nas avaliações aprovadas pelo gestor.</p>
        </div>
      )}

      {/* Podium */}
      {podium.length >= 1 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold text-brand-gray uppercase tracking-widest mb-6">Pódio</h2>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            {PODIUM_CONFIG.map(({ pos, icon: Icon, color, bgColor, iconSize, scale }, i) => {
              const b = podiumOrder[i];
              if (!b) return null;
              const bank = bankList.find(bk => bk.id === b.id);
              const heights = ['h-28', 'h-36', 'h-24'];
              return (
                <Link
                  key={b.id}
                  to={`/banks/${b.id}`}
                  className={`${scale} transform transition-transform hover:scale-105`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs font-semibold text-brand-gray">{bank?.shortName}</div>
                    <Score100Badge score={b.score} size="md" />
                    <div
                      className={`${heights[i]} w-20 sm:w-28 rounded-t-2xl flex flex-col items-center justify-end pb-4 gap-2`}
                      style={{ backgroundColor: bgColor, border: `1px solid ${color}22` }}
                    >
                      <Icon size={iconSize} style={{ color }} />
                      <div className="text-xl font-bold font-display" style={{ color }}>#{pos}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Full list */}
      {withScores.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-brand-black font-display">Classificação Completa</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {ranked.map((b) => {
              const bank = bankList.find(bk => bk.id === b.id);
              return (
                <Link
                  key={b.id}
                  to={`/banks/${b.id}`}
                  className="flex items-center gap-5 px-6 py-4 hover:bg-gray-50/60 transition-colors group"
                >
                  <div className="w-8 text-center">
                    {b.rank <= 3 ? (
                      <span className="text-base font-bold font-display" style={{
                        color: b.rank === 1 ? '#f59e0b' : b.rank === 2 ? '#94a3b8' : '#cd7c3f'
                      }}>#{b.rank}</span>
                    ) : (
                      <span className="text-sm font-medium text-brand-gray">#{b.rank}</span>
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: '#1818db' }}>
                    {bank?.shortName?.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-brand-black group-hover:text-brand-blue transition-colors">
                      {bank?.shortName}
                    </div>
                    <div className="text-xs text-brand-gray truncate">{bank?.name}</div>
                  </div>

                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600">
                    Aprovada
                  </span>

                  {b.score > 0 ? (
                    <Score100Badge score={b.score} size="sm" />
                  ) : (
                    <span className="text-xs text-brand-gray">Sem dados</span>
                  )}

                  <ChevronRight size={14} className="text-brand-gray group-hover:text-brand-blue transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
