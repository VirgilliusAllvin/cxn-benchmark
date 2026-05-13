import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  ChevronLeft, ClipboardList, Link2, FileText, Trash2,
  CheckCircle, Clock, XCircle, AlertTriangle,
} from 'lucide-react';
import { DIMENSIONS, CRITERIA, CRITERIA_BY_DIMENSION, TAG_COLORS } from '../lib/data';
import { useStore } from '../lib/store';
import { dimensionScore, globalScore100, rankBanks, evaluatedCriterionCount, evidenceCount } from '../lib/calculations';
import { Score100Badge, ScoreBadge } from '../components/ScoreBadge';
import type { Tag } from '../lib/data';
import type { EvaluationStatus } from '../lib/types';

const STATUS_CONFIG: Record<EvaluationStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  draft:     { label: 'Rascunho',  bg: 'bg-gray-100',   text: 'text-gray-500',  icon: Clock },
  submitted: { label: 'Em revisão', bg: 'bg-amber-50',  text: 'text-amber-600', icon: Clock },
  approved:  { label: 'Aprovada',  bg: 'bg-green-50',   text: 'text-green-600', icon: CheckCircle },
  rejected:  { label: 'Rejeitada', bg: 'bg-red-50',     text: 'text-red-600',   icon: XCircle },
};

export function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, removeEvidence, updateBankNotes } = useStore();
  const [activeTab, setActiveTab] = useState<'scorecard' | 'evidence' | 'notes'>('scorecard');

  const bankList = state.bankList;
  const bank = bankList.find(b => b.id === id);
  const bData = id ? state.banks[id] : undefined;

  // Encontrar a avaliação activa
  const evaluation = id ? state.evaluations.find(e => e.bankId === id) : undefined;
  const evaluationId = evaluation?.id;
  const evalStatus = bData?.status ?? 'draft';

  if (!bank || !bData) {
    return <div className="p-8 text-brand-gray">Banco não encontrado.</div>;
  }

  const allBanks = bankList.map(b => ({ id: b.id, data: state.banks[b.id] })).filter(b => b.data);
  const ranked = rankBanks(allBanks, state.dimensionWeights);
  const thisRanked = ranked.find(r => r.id === id);

  const score = globalScore100(bData, state.dimensionWeights);
  const evaluated = evaluatedCriterionCount(bData);
  const evCount = evidenceCount(bData);
  const totalCriteria = CRITERIA.length;

  const radarData = DIMENSIONS.map(d => ({
    dim: d.shortName,
    score: Math.round(dimensionScore(bData, d.id) * 20 * 10) / 10,
  }));

  const allEvidences = CRITERIA.flatMap(c =>
    (bData.criterionScores?.[c.id]?.evidences ?? []).map(ev => ({ ...ev, criterionName: c.name }))
  );

  const TABS = [
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'evidence', label: `Evidências (${evCount})` },
    { key: 'notes', label: 'Observações' },
  ] as const;

  const statusCfg = STATUS_CONFIG[evalStatus] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  async function handleRemoveEvidence(criterionId: string, evidenceId: string) {
    if (!evaluationId) return;
    await removeEvidence(evaluationId, criterionId, evidenceId);
  }

  return (
    <div className="p-8 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-brand-gray hover:text-brand-black mb-6 transition-colors">
        <ChevronLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
              style={{ background: '#1818db' }}>
              {bank.shortName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-brand-black">{bank.shortName}</h1>
              <p className="text-sm text-brand-gray">{bank.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                  <StatusIcon size={10} />
                  {statusCfg.label}
                </span>
              </div>

              {/* Rejection comment */}
              {evalStatus === 'rejected' && evaluation?.rejectionComment && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 max-w-sm">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{evaluation.rejectionComment}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="text-center">
              <Score100Badge score={score} size="xl" />
              <div className="text-xs text-brand-gray mt-1">Score Global</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-brand-black">#{thisRanked?.rank ?? '—'}</div>
              <div className="text-xs text-brand-gray mt-1">Posição</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-brand-black">{evaluated}/{totalCriteria}</div>
              <div className="text-xs text-brand-gray mt-1">Critérios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-brand-black">{evCount}</div>
              <div className="text-xs text-brand-gray mt-1">Evidências</div>
            </div>
          </div>
        </div>
      </div>

      {/* Radar + Dimensions */}
      <div className="grid grid-cols-5 gap-5 mb-6">
        <div className="col-span-2 bg-white rounded-2xl p-5 shadow-card border border-gray-100">
          <h2 className="text-sm font-bold font-display text-brand-black mb-3">Perfil por Dimensão</h2>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#f0f0f0" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 9, fill: '#494949' }} />
              <Radar dataKey="score" stroke="#1818db" fill="#1818db" fillOpacity={0.1} strokeWidth={2} />
              <Tooltip formatter={(v) => [Number(v).toFixed(1), 'Score']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-3 bg-white rounded-2xl p-5 shadow-card border border-gray-100">
          <h2 className="text-sm font-bold font-display text-brand-black mb-4">Score por Dimensão</h2>
          <div className="space-y-3">
            {DIMENSIONS.map(d => {
              const ds = dimensionScore(bData, d.id);
              const pct = Math.round(ds * 20);
              const weight = state.dimensionWeights[d.id] ?? 0;
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="text-xs text-brand-dark font-bold w-6">{d.id}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-brand-dark truncate max-w-[180px]">{d.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-brand-gray text-[10px]">{weight}%</span>
                        <span className="font-bold" style={{ color: pct >= 80 ? '#1ddbb1' : pct >= 60 ? '#22c55e' : pct >= 40 ? '#eab308' : pct > 0 ? '#ef4444' : '#9ca3af' }}>
                          {pct}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? '#1ddbb1' : pct >= 60 ? '#22c55e' : pct >= 40 ? '#eab308' : pct > 0 ? '#ef4444' : '#e5e7eb',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center border-b border-gray-100 px-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3.5 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-brand-gray hover:text-brand-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto pr-4">
            <Link
              to={`/avaliacao?bank=${id}`}
              className="flex items-center gap-1.5 text-xs bg-brand-blue text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <ClipboardList size={12} /> Avaliar
            </Link>
          </div>
        </div>

        {/* Scorecard */}
        {activeTab === 'scorecard' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-brand-gray font-medium">ID</th>
                  <th className="text-left px-4 py-3 text-brand-gray font-medium">Critério</th>
                  <th className="text-left px-4 py-3 text-brand-gray font-medium">Tipo</th>
                  <th className="text-center px-4 py-3 text-brand-gray font-medium">Score</th>
                  <th className="text-left px-4 py-3 text-brand-gray font-medium">Dispositivo</th>
                  <th className="text-left px-4 py-3 text-brand-gray font-medium">Observações</th>
                  <th className="text-center px-4 py-3 text-brand-gray font-medium">Evidências</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map(dim => {
                  const criteria = CRITERIA_BY_DIMENSION[dim.id] ?? [];
                  const weight = state.dimensionWeights[dim.id] ?? 0;
                  return (
                    <>
                      <tr key={`dim-${dim.id}`} className="bg-gray-50/80 border-t border-gray-100">
                        <td colSpan={7} className="px-5 py-2">
                          <span className="text-xs font-bold text-brand-dark">{dim.id} — {dim.name}</span>
                          <span className="ml-2 text-[10px] text-brand-gray">{weight}% do score</span>
                        </td>
                      </tr>
                      {criteria.map(criterion => {
                        const cs = bData.criterionScores?.[criterion.id];
                        const scoreVal = cs?.score ?? 0;
                        return (
                          <tr key={criterion.id} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                            <td className="px-5 py-3 font-mono font-medium text-brand-dark">{criterion.id}</td>
                            <td className="px-4 py-3 font-medium text-brand-black">{criterion.name}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                criterion.type === 'binary' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {criterion.type === 'binary' ? 'Bin.' : 'Esc.'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {criterion.type === 'binary' ? (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  scoreVal === 5 ? 'bg-green-50 text-green-600' :
                                  scoreVal === 0 ? 'bg-gray-100 text-gray-400' :
                                  'bg-red-50 text-red-500'
                                }`}>
                                  {scoreVal === 5 ? 'Sim' : scoreVal === 0 ? '—' : 'Não'}
                                </span>
                              ) : (
                                <ScoreBadge score={scoreVal} size="sm" showLabel />
                              )}
                            </td>
                            <td className="px-4 py-3 text-brand-gray">{cs?.device || '—'}</td>
                            <td className="px-4 py-3 text-brand-gray max-w-[200px]">
                              <span className="line-clamp-2 block">{cs?.observations || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-brand-gray">{cs?.evidences?.length ?? 0}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Evidence */}
        {activeTab === 'evidence' && (
          <div className="p-6">
            {allEvidences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-brand-gray">
                <FileText size={32} className="mb-3 opacity-30" />
                <p className="text-sm">Nenhuma evidência registada ainda.</p>
                <Link to={`/avaliacao?bank=${id}`} className="mt-3 text-xs text-brand-blue hover:underline">
                  Adicionar evidências na avaliação →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {allEvidences.map(ev => (
                  <div key={ev.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {ev.type === 'link' ? <Link2 size={12} className="text-brand-blue" /> : <FileText size={12} className="text-brand-gray" />}
                        <span className="text-[10px] text-brand-gray font-medium">{ev.criterionName}</span>
                      </div>
                      {evalStatus !== 'submitted' && evalStatus !== 'approved' && (
                        <button
                          onClick={() => handleRemoveEvidence(ev.criterionId, ev.id)}
                          className="text-brand-gray hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    {ev.type === 'link' ? (
                      <a href={ev.content} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-blue hover:underline break-all line-clamp-2">
                        {ev.content}
                      </a>
                    ) : (
                      <p className="text-xs text-brand-dark line-clamp-3">{ev.content}</p>
                    )}
                    {ev.description && <p className="text-xs text-brand-gray mt-2 line-clamp-2">{ev.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(ev.tags as string[]).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: TAG_COLORS[tag as Tag]?.bg ?? '#f3f4f6', color: TAG_COLORS[tag as Tag]?.text ?? '#6b7280' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-brand-gray mt-2">
                      {new Date(ev.collectedAt).toLocaleDateString('pt-AO')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div className="p-6">
            <label className="block text-xs font-bold text-brand-dark mb-2">Observações Estratégicas</label>
            <textarea
              className="w-full h-48 text-sm border border-gray-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-brand-dark placeholder-brand-gray disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder={evalStatus === 'submitted' || evalStatus === 'approved' ? '' : 'Adicione observações estratégicas, insights ou recomendações para este banco...'}
              disabled={evalStatus === 'submitted' || evalStatus === 'approved'}
              value={bData.notes}
              onChange={e => evaluationId && updateBankNotes(evaluationId, e.target.value)}
            />
            {evalStatus !== 'submitted' && evalStatus !== 'approved' && (
              <p className="text-xs text-brand-gray mt-2">Guardado automaticamente.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
