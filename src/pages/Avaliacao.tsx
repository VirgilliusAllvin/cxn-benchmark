import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, ChevronDown, ChevronUp, Link2, FileText,
  Plus, X, Save, Send, AlertTriangle, Lock, Image as ImageIcon, Clock,
} from 'lucide-react';
import { DIMENSIONS, CRITERIA_BY_DIMENSION, SCORE_LABELS, TAGS, TAG_COLORS } from '../lib/data';
import { useStore } from '../lib/store';
import { uploadEvidenceImage } from '../lib/db';
import { evaluatedCriterionCount, globalScore100, dimensionScore } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';
import { Score100Badge } from '../components/ScoreBadge';
import { ObservationField } from '../components/ObservationField';
import { useAuth } from '../contexts/AuthContext';
import type { Tag } from '../lib/data';

const DEVICES = ['Android', 'iOS', 'Web', 'Outro'];

export function Avaliacao() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    state,
    updateCriterionScore,
    addEvidence,
    removeEvidence,
    startEvaluation,
    submitForReview,
    requestAccess,
    cancelAccess,
  } = useStore();

  const activeCycleId = state.activeCycleId;
  const activeCycle = state.cycles.find(c => c.id === activeCycleId);

  const bankList = state.bankList;
  const firstBank = bankList[0]?.id ?? '';

  const [selectedBank, setSelectedBank] = useState(params.get('bank') ?? firstBank);
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set(['D1']));
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startingEval, setStartingEval] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState<Record<string, {
    type: 'link' | 'note' | 'image'; content: string; description: string; tags: Tag[]; file?: File; previewUrl?: string
  }>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Manter ref actualizada para revogar previewUrls abertas ao desmontar (ex.: trocar de banco)
  const pendingEvidenceRef = useRef(pendingEvidence);
  pendingEvidenceRef.current = pendingEvidence;
  useEffect(() => () => {
    Object.values(pendingEvidenceRef.current).forEach(e => {
      if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
    });
  }, []);

  // Encontrar avaliação activa para o banco seleccionado
  const evaluation = state.evaluations.find(e => e.bankId === selectedBank);
  const evaluationId = evaluation?.id;
  const evalStatus = evaluation?.status ?? null;

  // Agente só pode editar em draft ou rejected
  const isAgente = profile?.role === 'agente';
  const isGestor = profile?.role === 'gestor';
  const canEdit = isGestor || !evalStatus
    || ((evalStatus === 'draft' || evalStatus === 'rejected') && bankStatus(selectedBank) === 'mine');
  const isLocked = !canEdit;

  useEffect(() => {
    const p = params.get('bank');
    if (p) setSelectedBank(p);
  }, [params]);

  if (!activeCycle || activeCycle.status !== 'open') {
    return (
      <div className="p-4 md:p-8 animate-fade-in">
        <PageHeader title="Avaliacao" subtitle="Avaliar bancos por dimensao" />
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <AlertTriangle size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhum ciclo de avaliacao aberto.</p>
          <p className="text-xs mt-1">Contacte o gestor para abrir um novo ciclo.</p>
        </div>
      </div>
    );
  }

  const bData = state.banks[selectedBank];
  const evaluated = bData ? evaluatedCriterionCount(bData) : 0;
  const totalCriteria = Object.values(CRITERIA_BY_DIMENSION).reduce((s, arr) => s + arr.length, 0);
  const score = bData ? globalScore100(bData, state.dimensionWeights) : 0;

  // Estado de reivindicação do banco no ciclo activo: disponível, meu, ocupado por outro agente, submetido ou aprovado
  function bankStatus(bankId: string): 'available' | 'mine' | 'taken' | 'submitted' | 'approved' {
    const ev = state.evaluations.find(e => e.bankId === bankId && e.cycleId === activeCycleId);
    if (!ev) return 'available';
    if (ev.status === 'approved') return 'approved';
    if (ev.status === 'submitted') return 'submitted';
    if (ev.agenteId === profile?.id) return 'mine';
    return 'taken';
  }

  const myPendingRequest = evaluation
    ? state.accessRequests.find(r => r.evaluationId === evaluation.id && r.requesterId === profile?.id && r.status === 'pending')
    : null;

  async function handleRequestAccess() {
    if (!evaluation) return;
    setRequestingAccess(true);
    setAccessError(null);
    try {
      await requestAccess(evaluation.id);
    } catch (err) {
      console.error('[Avaliacao] Erro ao pedir acesso:', err);
      setAccessError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido de acesso.');
    } finally {
      setRequestingAccess(false);
    }
  }

  async function handleCancelAccess() {
    if (!myPendingRequest) return;
    setRequestingAccess(true);
    setAccessError(null);
    try {
      await cancelAccess(myPendingRequest.id);
    } catch (err) {
      console.error('[Avaliacao] Erro ao cancelar pedido:', err);
      setAccessError(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setRequestingAccess(false);
    }
  }

  async function ensureEvaluation() {
    if (!activeCycleId) return null;
    const status = bankStatus(selectedBank);
    if (!isGestor && (status === 'taken' || status === 'submitted' || status === 'approved')) return null;
    if (evaluationId) return evaluationId;
    setStartingEval(true);
    const ev = await startEvaluation(selectedBank);
    setStartingEval(false);
    return ev?.id ?? null;
  }

  async function handleScoreChange(criterionId: string, scoreVal: number) {
    const eid = await ensureEvaluation();
    if (!eid) return;
    // Marcar como respondido — inclui "Não" binário (score 0)
    await updateCriterionScore(eid, criterionId, { score: scoreVal, answered: true });
  }

  async function handleFieldChange(criterionId: string, field: 'observations' | 'device', value: string) {
    const eid = await ensureEvaluation();
    if (!eid) return;
    await updateCriterionScore(eid, criterionId, { [field]: value });
  }

  function toggleDim(id: string) {
    setExpandedDims(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function initEvidence(criterionId: string) {
    if (!pendingEvidence[criterionId]) {
      setPendingEvidence(p => ({ ...p, [criterionId]: { type: 'note', content: '', description: '', tags: [] } }));
    }
  }

  function toggleEvidenceTag(criterionId: string, tag: Tag) {
    setPendingEvidence(p => {
      const ev = p[criterionId];
      if (!ev) return p;
      const tags = ev.tags.includes(tag) ? ev.tags.filter(t => t !== tag) : [...ev.tags, tag];
      return { ...p, [criterionId]: { ...ev, tags } };
    });
  }

  async function submitEvidence(criterionId: string) {
    const ev = pendingEvidence[criterionId];
    if (!ev) return;
    // Imagem precisa de ficheiro; link/nota precisam de conteúdo
    if (ev.type === 'image' ? !ev.file : !ev.content.trim()) return;
    const eid = await ensureEvaluation();
    if (!eid) return;

    // Clear any previous upload error for this criterion on each attempt
    setUploadError(e => { const n = { ...e }; delete n[criterionId]; return n; });

    let content = ev.content.trim();
    if (ev.type === 'image' && ev.file) {
      setUploading(u => ({ ...u, [criterionId]: true }));
      try {
        content = await uploadEvidenceImage(ev.file);
      } catch (err) {
        console.error('[Avaliacao] Erro ao carregar imagem:', err);
        setUploading(u => { const n = { ...u }; delete n[criterionId]; return n; });
        setUploadError(e => ({ ...e, [criterionId]: 'Não foi possível carregar a imagem. Tenta novamente.' }));
        return;
      }
      setUploading(u => { const n = { ...u }; delete n[criterionId]; return n; });
    }

    await addEvidence(eid, criterionId, {
      type: ev.type,
      content,
      description: ev.description.trim(),
      tags: ev.tags as string[],
    });
    // Revoke preview URL on successful add
    if (ev.previewUrl) URL.revokeObjectURL(ev.previewUrl);
    setUploadError(e => { const n = { ...e }; delete n[criterionId]; return n; });
    setPendingEvidence(p => { const n = { ...p }; delete n[criterionId]; return n; });
  }

  async function handleRemoveEvidence(criterionId: string, evidenceId: string) {
    if (!evaluationId) return;
    await removeEvidence(evaluationId, criterionId, evidenceId);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => {
      navigate(`/banks/${selectedBank}`);
    }, 800);
  }

  async function handleSubmit() {
    if (!evaluationId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitForReview(evaluationId);
      navigate(`/banks/${selectedBank}`);
    } catch (err) {
      console.error('[Avaliacao] Erro ao submeter para revisão:', err);
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível submeter. Tenta novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_BANNER: Record<string, { bg: string; text: string; icon: React.ReactNode; msg: string }> = {
    submitted: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      icon: <Lock size={14} />,
      msg: 'Esta avaliação foi submetida para revisão. Aguarda aprovação do gestor.',
    },
    approved: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-700',
      icon: <CheckCircle size={14} />,
      msg: 'Avaliação aprovada. Os dados estão visíveis no dashboard e ranking.',
    },
    rejected: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: <AlertTriangle size={14} />,
      msg: evaluation?.rejectionComment
        ? `Rejeitada pelo gestor: "${evaluation.rejectionComment}". Corrija e resubmeta.`
        : 'Avaliação rejeitada. Corrija e resubmeta.',
    },
  };

  const banner = evalStatus && evalStatus !== 'draft' ? STATUS_BANNER[evalStatus] : null;

  if (bankList.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <PageHeader title="Avaliação" subtitle="Nenhum banco disponível" />
        <p className="text-brand-gray text-sm mt-4">
          Não existem bancos configurados. Contacte o gestor.
        </p>
      </div>
    );
  }

  const bankInfo = bankList.find(b => b.id === selectedBank);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Avaliação"
        subtitle={bankInfo ? `${bankInfo.shortName} — ${bankInfo.name}` : 'Inserção de scores por critério'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-all ${
                saved ? 'bg-green-500 text-white' : 'bg-gray-100 text-brand-dark hover:bg-gray-200'
              }`}
            >
              {saved ? <><CheckCircle size={14} /> Guardado!</> : <><Save size={14} /> Guardar</>}
            </button>

            {/* Botão submeter — apenas agente, apenas quando em draft */}
            {isAgente && (!evalStatus || evalStatus === 'draft' || evalStatus === 'rejected') && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !evaluationId || evaluated === 0}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold bg-brand-blue text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Send size={14} /> Submeter para Revisão</>
                }
              </button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      {banner && (
        <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl border mb-5 ${banner.bg} ${banner.text}`}>
          {banner.icon}
          <span>{banner.msg}</span>
        </div>
      )}

      {/* Submit error banner */}
      {submitError && (
        <div className="flex items-start gap-2 text-sm px-4 py-3 rounded-xl border mb-5 bg-red-50 border-red-200 text-red-700">
          <AlertTriangle size={14} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Bank selector + progress */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-brand-dark mb-2">Banco</label>
            <select
              value={selectedBank}
              onChange={e => setSelectedBank(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-brand-black"
            >
              {bankList.map(b => {
                const bStatus = bankStatus(b.id);
                const suffix = bStatus === 'taken'
                  ? ' — em avaliação por outro agente'
                  : bStatus === 'submitted'
                    ? ' — submetido para revisão'
                    : bStatus === 'approved'
                      ? ' — aprovado'
                      : '';
                return (
                  <option key={b.id} value={b.id} disabled={bStatus === 'taken'}>
                    {b.shortName} — {b.name}{suffix}
                  </option>
                );
              })}
            </select>
            {(() => {
              if (bankStatus(selectedBank) !== 'taken') return null;
              return (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg bg-red-50 text-red-600">
                    <AlertTriangle size={11} />
                    Em avaliação por outro agente
                  </div>
                  {isAgente && (
                    myPendingRequest ? (
                      <button
                        onClick={handleCancelAccess}
                        disabled={requestingAccess}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-40"
                      >
                        {requestingAccess ? (
                          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Clock size={11} />
                        )}
                        Pedido pendente — Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={handleRequestAccess}
                        disabled={requestingAccess}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-brand-blue text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        {requestingAccess ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                        Pedir Acesso
                      </button>
                    )
                  )}
                  {accessError && (
                    <span className="text-[11px] text-red-500">{accessError}</span>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="shrink-0">
            <div className="text-xs font-bold text-brand-dark mb-2">Progresso</div>
            <div className="flex items-center gap-3">
              <div className="w-full sm:w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totalCriteria > 0 ? (evaluated / totalCriteria) * 100 : 0}%`,
                    background: '#1818db',
                  }}
                />
              </div>
              <span className="text-xs text-brand-dark font-medium">{evaluated}/{totalCriteria} critérios</span>
            </div>
          </div>

          <div className="shrink-0 text-center">
            <div className="text-xs font-bold text-brand-dark mb-1">Score Actual</div>
            <Score100Badge score={score} size="lg" />
          </div>
        </div>
      </div>

      {/* Loading evaluation */}
      {startingEval && (
        <div className="flex items-center gap-2 text-sm text-brand-gray mb-4">
          <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          A inicializar avaliação...
        </div>
      )}

      {/* Dimension accordion */}
      <div className="space-y-3">
        {DIMENSIONS.map(dim => {
          const criteria = CRITERIA_BY_DIMENSION[dim.id] ?? [];
          const expanded = expandedDims.has(dim.id);
          const dimSc = bData ? dimensionScore(bData, dim.id) : 0;
          const dimEvaluated = criteria.filter(c => bData?.criterionScores[c.id]?.answered).length;
          const weight = state.dimensionWeights[dim.id] ?? 0;

          return (
            <div key={dim.id} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              {/* Dimension header */}
              <button
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors"
                onClick={() => toggleDim(dim.id)}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: dim.color }}>
                  {dim.id}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-bold text-brand-black">{dim.name}</div>
                  <div className="text-xs text-brand-gray mt-0.5">
                    {dimEvaluated}/{criteria.length} avaliados · peso {weight}%
                  </div>
                </div>
                <div className="shrink-0 text-right mr-2">
                  <span className="text-xs font-bold" style={{ color: '#1818db' }}>
                    {dimSc > 0 ? dimSc.toFixed(1) : '—'}<span className="font-normal text-brand-gray">/5</span>
                  </span>
                </div>
                {isLocked && <Lock size={13} className="text-brand-gray shrink-0 mr-1" />}
                {expanded ? <ChevronUp size={16} className="text-brand-gray" /> : <ChevronDown size={16} className="text-brand-gray" />}
              </button>

              {/* Criteria */}
              {expanded && (
                <div className={`border-t border-gray-100 divide-y divide-gray-50 ${isLocked ? 'opacity-75' : ''}`}>
                  {criteria.map(criterion => {
                    const cs = bData?.criterionScores[criterion.id];
                    const scoreVal = cs?.score ?? 0;
                    const pending = pendingEvidence[criterion.id];
                    const isBinary = criterion.type === 'binary';

                    return (
                      <div key={criterion.id} className="px-6 py-5">
                        {/* Criterion header */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="font-mono text-xs font-bold text-brand-gray bg-gray-100 px-2 py-0.5 rounded shrink-0">{criterion.id}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-brand-black">{criterion.name}</div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                isBinary ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {isBinary ? 'Binário' : 'Escalar'}
                              </span>
                            </div>
                            <div className="text-xs text-brand-gray mt-1">{criterion.question}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Score selector */}
                          <div className="md:col-span-5">
                            <label className="text-xs font-bold text-brand-dark mb-2 block">
                              {isBinary ? 'Resposta' : 'Score (1–5)'}
                            </label>

                            {isBinary ? (
                              <div className="flex gap-2">
                                <button
                                  disabled={isLocked}
                                  onClick={() => handleScoreChange(criterion.id, 0)}
                                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                                    isLocked ? 'cursor-not-allowed' : ''
                                  } ${
                                    cs?.answered && scoreVal === 0
                                      ? 'border-red-400 bg-red-50 text-red-600 shadow-sm'
                                      : 'border-gray-200 bg-gray-50 text-brand-gray hover:border-red-200 hover:bg-red-50/50'
                                  }`}
                                >
                                  Não
                                </button>
                                <button
                                  disabled={isLocked}
                                  onClick={() => handleScoreChange(criterion.id, 5)}
                                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                                    isLocked ? 'cursor-not-allowed' : ''
                                  } ${
                                    scoreVal === 5
                                      ? 'border-green-400 bg-green-50 text-green-600 shadow-sm'
                                      : 'border-gray-200 bg-gray-50 text-brand-gray hover:border-green-200 hover:bg-green-50/50'
                                  }`}
                                >
                                  Sim
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map(s => {
                                  const meta = SCORE_LABELS[s];
                                  const active = scoreVal === s;
                                  return (
                                    <button
                                      key={s}
                                      disabled={isLocked}
                                      onClick={() => handleScoreChange(criterion.id, s)}
                                      title={meta.label}
                                      className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                                        active ? 'shadow-sm scale-105' : 'opacity-50 hover:opacity-80'
                                      } ${isLocked ? 'cursor-not-allowed' : ''}`}
                                      style={{
                                        borderColor: active ? meta.color : 'transparent',
                                        background: active ? meta.bg : '#f9fafb',
                                        color: active ? meta.color : '#9ca3af',
                                      }}
                                    >
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {((isBinary && cs?.answered) || (!isBinary && scoreVal > 0)) && (
                              <div className="text-xs mt-1.5 font-medium" style={{ color: isBinary ? (scoreVal === 5 ? '#16a34a' : '#dc2626') : SCORE_LABELS[scoreVal]?.color }}>
                                {isBinary
                                  ? (scoreVal === 5 ? 'Sim — Funcionalidade presente' : 'Não — Funcionalidade ausente')
                                  : SCORE_LABELS[scoreVal]?.label
                                }
                              </div>
                            )}
                          </div>

                          {/* Device */}
                          <div className="md:col-span-2">
                            <label className="text-xs font-bold text-brand-dark mb-2 block">Dispositivo</label>
                            <select
                              disabled={isLocked}
                              value={cs?.device ?? ''}
                              onChange={e => handleFieldChange(criterion.id, 'device', e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                            >
                              <option value="">—</option>
                              {DEVICES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>

                          {/* Observations */}
                          <div className="md:col-span-5">
                            <label className="text-xs font-bold text-brand-dark mb-2 block">Observações</label>
                            <ObservationField
                              key={`${selectedBank}-${criterion.id}`}
                              initial={cs?.observations ?? ''}
                              disabled={isLocked}
                              placeholder={isLocked ? '' : 'Detalhe o que observou...'}
                              onChange={v => handleFieldChange(criterion.id, 'observations', v)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all placeholder-brand-gray disabled:bg-gray-50 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Evidences */}
                        <div className="mt-4">
                          {(cs?.evidences?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {cs!.evidences.map(ev => (
                                <div key={ev.id} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
                                  {ev.type === 'image'
                                    ? <ImageIcon size={10} className="text-violet-500" />
                                    : ev.type === 'link'
                                      ? <Link2 size={10} className="text-brand-blue" />
                                      : <FileText size={10} className="text-brand-gray" />}
                                  {ev.type === 'image' ? (
                                    <a href={ev.content} target="_blank" rel="noopener noreferrer">
                                      <img src={ev.content} alt="evidência" className="h-8 w-8 object-cover rounded" />
                                    </a>
                                  ) : (
                                    <span className="max-w-[160px] truncate text-brand-dark">{ev.content}</span>
                                  )}
                                  {ev.tags.map(tag => (
                                    <span key={tag} className="text-[9px] px-1 py-0.5 rounded" style={{ background: TAG_COLORS[tag as Tag]?.bg, color: TAG_COLORS[tag as Tag]?.text }}>{tag}</span>
                                  ))}
                                  {!isLocked && (
                                    <button onClick={() => handleRemoveEvidence(criterion.id, ev.id)} className="text-brand-gray hover:text-red-500 transition-colors ml-1">
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {!isLocked && (
                            pending ? (
                              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {(['link', 'note', 'image'] as const).map(t => (
                                    <button
                                      key={t}
                                      onClick={() => {
                                        setPendingEvidence(p => {
                                          const prev = p[criterion.id];
                                          // Revoke preview URL when switching away from image type
                                          if (prev?.previewUrl && t !== 'image') URL.revokeObjectURL(prev.previewUrl);
                                          return { ...p, [criterion.id]: { ...prev, type: t, content: '', file: undefined, previewUrl: t !== 'image' ? undefined : prev?.previewUrl } };
                                        });
                                        // Clear upload error on type switch
                                        setUploadError(err => { const n = { ...err }; delete n[criterion.id]; return n; });
                                      }}
                                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                                        pending.type === t ? 'bg-brand-blue text-white' : 'bg-white border border-gray-200 text-brand-dark'
                                      }`}
                                    >
                                      {t === 'link'
                                        ? <><Link2 size={10} /> Link</>
                                        : t === 'note'
                                          ? <><FileText size={10} /> Nota</>
                                          : <><ImageIcon size={10} /> Imagem</>}
                                    </button>
                                  ))}
                                </div>
                                {pending.type === 'image' ? (
                                  <div className="mb-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        setPendingEvidence(p => {
                                          const prev = p[criterion.id];
                                          // Revoke previous preview URL to avoid memory leak
                                          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
                                          const previewUrl = file ? URL.createObjectURL(file) : undefined;
                                          return { ...p, [criterion.id]: { ...prev, file, content: file?.name ?? '', previewUrl } };
                                        });
                                        // Clear upload error when user picks a new file
                                        setUploadError(err => { const n = { ...err }; delete n[criterion.id]; return n; });
                                      }}
                                      className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:text-white file:px-3 file:py-1.5 file:text-xs file:font-medium text-brand-gray"
                                    />
                                    {pending.previewUrl && (
                                      <img
                                        src={pending.previewUrl}
                                        alt="pré-visualização"
                                        className="mt-2 h-24 rounded-lg object-cover border border-gray-200"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type={pending.type === 'link' ? 'url' : 'text'}
                                    placeholder={pending.type === 'link' ? 'https://...' : 'Descreva a evidência...'}
                                    value={pending.content}
                                    onChange={e => setPendingEvidence(p => ({ ...p, [criterion.id]: { ...p[criterion.id], content: e.target.value } }))}
                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                  />
                                )}
                                <input
                                  type="text"
                                  placeholder="Descrição (opcional)"
                                  value={pending.description}
                                  onChange={e => setPendingEvidence(p => ({ ...p, [criterion.id]: { ...p[criterion.id], description: e.target.value } }))}
                                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                />
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {TAGS.map(tag => (
                                    <button
                                      key={tag}
                                      onClick={() => toggleEvidenceTag(criterion.id, tag)}
                                      className="text-[11px] px-2 py-0.5 rounded-md font-medium transition-all"
                                      style={{
                                        background: pending.tags.includes(tag) ? TAG_COLORS[tag].bg : '#f3f4f6',
                                        color: pending.tags.includes(tag) ? TAG_COLORS[tag].text : '#9ca3af',
                                      }}
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                                {uploadError[criterion.id] && (
                                  <p className="text-xs text-red-500 mb-2">{uploadError[criterion.id]}</p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => submitEvidence(criterion.id)}
                                    disabled={uploading[criterion.id]}
                                    className="flex items-center gap-1.5 text-xs bg-brand-blue text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {uploading[criterion.id]
                                      ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> A carregar…</>
                                      : 'Adicionar'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Revoke preview URL on cancel to free memory
                                      const prev = pendingEvidence[criterion.id];
                                      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
                                      setUploadError(err => { const n = { ...err }; delete n[criterion.id]; return n; });
                                      setPendingEvidence(p => { const n = { ...p }; delete n[criterion.id]; return n; });
                                    }}
                                    className="text-xs text-brand-gray hover:text-brand-black px-2 py-1.5 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => initEvidence(criterion.id)}
                                className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline transition-colors"
                              >
                                <Plus size={12} /> Adicionar evidência
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-6 flex justify-end gap-3 mt-6">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 text-sm px-6 py-3 rounded-xl font-semibold shadow-blue transition-all ${
            saved ? 'bg-green-500 text-white' : 'bg-gray-200 text-brand-dark hover:bg-gray-300'
          }`}
        >
          {saved ? <><CheckCircle size={16} /> A guardar...</> : <><Save size={16} /> Guardar</>}
        </button>

        {isAgente && (!evalStatus || evalStatus === 'draft' || evalStatus === 'rejected') && (
          <button
            onClick={handleSubmit}
            disabled={submitting || !evaluationId || evaluated === 0}
            className="flex items-center gap-2 text-sm px-6 py-3 rounded-xl font-semibold bg-brand-blue text-white hover:bg-blue-700 shadow-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Send size={16} /> Submeter para Revisão</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
