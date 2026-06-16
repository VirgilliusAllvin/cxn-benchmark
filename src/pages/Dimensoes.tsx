import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DIMENSIONS, CRITERIA_BY_DIMENSION } from '../lib/data';
import { useSnapshot } from '../lib/store';
import { dimensionScore, marketDimensionAvg } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';
import { ScoreBadge } from '../components/ScoreBadge';

export function Dimensoes() {
  const state = useSnapshot();
  const [expanded, setExpanded] = useState<string | null>(null);

  const bankList = state.bankList;
  const allBankData = useMemo(() => Object.values(state.banks), [state]);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader title="Dimensões" subtitle="Análise de mercado por dimensão de avaliação" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DIMENSIONS.map(dim => {
          const isExp = expanded === dim.id;
          const marketAvg = marketDimensionAvg(allBankData, dim.id);
          const marketAvg100 = Math.round(marketAvg * 20 * 10) / 10;
          const criteria = CRITERIA_BY_DIMENSION[dim.id] ?? [];
          const weight = state.dimensionWeights[dim.id] ?? 0;

          // Per-bank data for chart
          const chartData = bankList
            .map(b => {
              const bData = state.banks[b.id];
              if (!bData) return null;
              const s = Math.round(dimensionScore(bData, dim.id) * 20 * 10) / 10;
              return { name: b.shortName, score: s };
            })
            .filter((d): d is { name: string; score: number } => d !== null && d.score > 0)
            .sort((a, b) => b.score - a.score);

          return (
            <div key={dim.id} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: dim.color }}>
                      {dim.id}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brand-black font-display">{dim.name}</div>
                      <div className="text-xs text-brand-gray mt-0.5">{dim.description}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-xs text-brand-gray">Peso</div>
                    <div className="text-sm font-bold text-brand-black">{weight}%</div>
                  </div>
                </div>

                {/* Market avg */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-xs text-brand-gray">Média de mercado:</div>
                  <div className="text-sm font-bold" style={{
                    color: marketAvg100 >= 80 ? '#1ddbb1' : marketAvg100 >= 60 ? '#22c55e' : marketAvg100 >= 40 ? '#eab308' : marketAvg100 > 0 ? '#ef4444' : '#9ca3af'
                  }}>
                    {marketAvg100.toFixed(0)}/100
                  </div>
                </div>

                {/* Bar chart */}
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#494949', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v) => [`${Number(v).toFixed(0)}`, 'Score']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11 }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={24}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.score >= 80 ? '#1ddbb1' : entry.score >= 60 ? '#22c55e' : entry.score >= 40 ? '#eab308' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-28 flex items-center justify-center text-xs text-brand-gray">
                    Sem dados disponíveis
                  </div>
                )}

                {/* Expand criteria */}
                <button
                  onClick={() => setExpanded(isExp ? null : dim.id)}
                  className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline mt-3 transition-colors"
                >
                  {isExp
                    ? <><ChevronUp size={12} /> Ocultar critérios</>
                    : <><ChevronDown size={12} /> Ver critérios ({criteria.length})</>
                  }
                </button>
              </div>

              {/* Criterion breakdown */}
              {isExp && (
                <div className="border-t border-gray-100">
                  {criteria.map((criterion, i) => (
                    <div key={criterion.id} className={`px-5 py-3 flex items-start gap-3 ${i < criteria.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="font-mono text-[10px] font-bold text-brand-gray bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{criterion.id}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-brand-black">{criterion.name}</div>
                        <div className="text-[10px] text-brand-gray mt-0.5">
                          {criterion.type === 'binary' ? 'Binário (Sim/Não)' : 'Escalar (1–5)'}
                        </div>
                      </div>
                      <div className="text-xs text-brand-gray shrink-0">
                        {(() => {
                          const scores = bankList
                            .map(b => state.banks[b.id]?.criterionScores?.[criterion.id]?.score ?? 0)
                            .filter(s => s > 0);
                          if (scores.length === 0) return '—';
                          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                          return <ScoreBadge score={Math.round(avg)} size="sm" showLabel />;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
