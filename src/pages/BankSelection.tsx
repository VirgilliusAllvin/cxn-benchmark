import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Play, Edit3, Eye, Send, Clock, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { evaluatedCriterionCount } from '../lib/calculations';
import { CRITERIA_BY_DIMENSION } from '../lib/data';
import type { Evaluation } from '../lib/types';

type BankStatus = 'available' | 'mine-draft' | 'mine-rejected' | 'mine-submitted' | 'approved' | 'taken';

function getBankStatus(
  bankId: string,
  evaluations: Evaluation[],
  activeCycleId: string | null,
  userId: string | undefined,
): BankStatus {
  const ev = evaluations.find(e => e.bankId === bankId && e.cycleId === activeCycleId);
  if (!ev) return 'available';
  if (ev.status === 'approved') return 'approved';
  if (ev.agenteId === userId) {
    if (ev.status === 'draft') return 'mine-draft';
    if (ev.status === 'rejected') return 'mine-rejected';
    if (ev.status === 'submitted') return 'mine-submitted';
  }
  return 'taken';
}

const STATUS_BADGE: Record<BankStatus, { label: string; bg: string; text: string }> = {
  'available': { label: 'Disponível', bg: 'bg-green-50', text: 'text-green-600' },
  'mine-draft': { label: 'Rascunho', bg: 'bg-gray-100', text: 'text-brand-gray' },
  'mine-rejected': { label: 'Rejeitada', bg: 'bg-red-50', text: 'text-red-600' },
  'mine-submitted': { label: 'Submetida', bg: 'bg-amber-50', text: 'text-amber-700' },
  'approved': { label: 'Aprovada', bg: 'bg-green-50', text: 'text-green-600' },
  'taken': { label: 'Em avaliação', bg: 'bg-red-50', text: 'text-red-600' },
};

const TOTAL_CRITERIA = Object.values(CRITERIA_BY_DIMENSION).reduce((s, arr) => s + arr.length, 0);

export function BankSelection() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { state, refreshEvaluations, startEvaluation, requestAccess, cancelAccess } = useStore();

  const isGestor = profile?.role === 'gestor';

  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [startingBankId, setStartingBankId] = useState<string | null>(null);
  const [startError, setStartError] = useState<Record<string, string>>({});
  const [accessError, setAccessError] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefreshing(true);
      try {
        await refreshEvaluations(isGestor);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGestor]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshEvaluations(isGestor);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRequestAccess(evaluationId: string) {
    setRequestingId(evaluationId);
    setAccessError(e => { const n = { ...e }; delete n[evaluationId]; return n; });
    try {
      await requestAccess(evaluationId);
    } catch (err) {
      console.error('[BankSelection] Erro ao pedir acesso:', err);
      setAccessError(e => ({ ...e, [evaluationId]: err instanceof Error ? err.message : 'Não foi possível enviar o pedido de acesso.' }));
    } finally {
      setRequestingId(null);
    }
  }

  async function handleCancelAccess(requestId: string, evaluationId: string) {
    setRequestingId(evaluationId);
    setAccessError(e => { const n = { ...e }; delete n[evaluationId]; return n; });
    try {
      await cancelAccess(requestId);
    } catch (err) {
      console.error('[BankSelection] Erro ao cancelar pedido:', err);
      setAccessError(e => ({ ...e, [evaluationId]: err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.' }));
    } finally {
      setRequestingId(null);
    }
  }

  async function handleStart(bankId: string) {
    setStartingBankId(bankId);
    setStartError(e => { const n = { ...e }; delete n[bankId]; return n; });
    try {
      const ev = await startEvaluation(bankId, profile?.id);
      if (!ev) {
        setStartError(e => ({ ...e, [bankId]: 'Este banco já está a ser avaliado por outro agente.' }));
        return;
      }
      navigate(`/avaliacao/${bankId}`);
    } catch (err) {
      console.error('[BankSelection] Erro ao iniciar avaliação:', err);
      setStartError(e => ({ ...e, [bankId]: err instanceof Error ? err.message : 'Não foi possível iniciar a avaliação.' }));
    } finally {
      setStartingBankId(null);
    }
  }

  const activeCycle = state.cycles.find(c => c.id === state.activeCycleId);

  if (!activeCycle || activeCycle.status !== 'open') {
    return (
      <div className="p-4 md:p-8 animate-fade-in">
        <PageHeader title="Avaliação" subtitle="Selecione um banco para avaliar" />
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <AlertTriangle size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhum ciclo de avaliação aberto.</p>
          <p className="text-xs mt-1">Contacte o gestor para abrir um novo ciclo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Avaliação"
        subtitle="Selecione um banco para avaliar"
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium bg-gray-100 text-brand-dark hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
        }
      />

      {refreshing && state.bankList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">A carregar bancos...</p>
        </div>
      ) : state.bankList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <Building2 size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Não existem bancos configurados.</p>
          <p className="text-xs mt-1">Contacte o gestor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.bankList.map(bank => {
            const evaluation = state.evaluations.find(e => e.bankId === bank.id && e.cycleId === state.activeCycleId);
            const status = getBankStatus(bank.id, state.evaluations, state.activeCycleId, profile?.id);
            const badge = STATUS_BADGE[status];
            const bData = state.banks[bank.id];
            const evaluated = bData ? evaluatedCriterionCount(bData) : 0;
            const showProgress = !!evaluation;

            const myPendingRequest = evaluation
              ? state.accessRequests.find(r => r.evaluationId === evaluation.id && r.requesterId === profile?.id && r.status === 'pending')
              : null;

            // Gestor pode ver tudo — sobrepõe a acção para "Ver" quando já existe avaliação
            const effectiveStatus: BankStatus = isGestor && evaluation ? 'approved' : status;

            return (
              <div key={bank.id} className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-brand-black truncate">{bank.shortName}</div>
                    <div className="text-xs text-brand-gray truncate">{bank.name}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>

                {showProgress && (
                  <div className="mt-3">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${TOTAL_CRITERIA > 0 ? (evaluated / TOTAL_CRITERIA) * 100 : 0}%`,
                          background: '#1818db',
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-brand-gray mt-1">{evaluated}/{TOTAL_CRITERIA} critérios</div>
                  </div>
                )}

                {status === 'mine-rejected' && evaluation?.rejectionComment && (
                  <div className="mt-3 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-2">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{evaluation.rejectionComment}</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-end gap-2">
                  {effectiveStatus === 'taken' && !isGestor ? (
                    myPendingRequest ? (
                      <button
                        onClick={() => evaluation && handleCancelAccess(myPendingRequest.id, evaluation.id)}
                        disabled={requestingId === evaluation?.id}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-40"
                      >
                        {requestingId === evaluation?.id ? (
                          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Clock size={12} />
                        )}
                        Pedido pendente — Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => evaluation && handleRequestAccess(evaluation.id)}
                        disabled={requestingId === evaluation?.id}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        {requestingId === evaluation?.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={12} />
                        )}
                        Pedir Acesso
                      </button>
                    )
                  ) : effectiveStatus === 'available' ? (
                    <button
                      onClick={() => handleStart(bank.id)}
                      disabled={startingBankId === bank.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {startingBankId === bank.id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Play size={12} />
                      }
                      Iniciar
                    </button>
                  ) : effectiveStatus === 'mine-draft' ? (
                    <button
                      onClick={() => navigate(`/avaliacao/${bank.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-blue-700 transition-colors"
                    >
                      <Play size={12} /> Continuar
                    </button>
                  ) : effectiveStatus === 'mine-rejected' ? (
                    <button
                      onClick={() => navigate(`/avaliacao/${bank.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                      <Edit3 size={12} /> Corrigir
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/avaliacao/${bank.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-brand-dark hover:bg-gray-200 transition-colors"
                    >
                      <Eye size={12} /> Ver
                    </button>
                  )}
                </div>

                {evaluation && accessError[evaluation.id] && (
                  <div className="mt-2 text-[11px] text-red-500 text-right">{accessError[evaluation.id]}</div>
                )}
                {startError[bank.id] && (
                  <div className="mt-2 text-[11px] text-red-500 text-right">{startError[bank.id]}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
