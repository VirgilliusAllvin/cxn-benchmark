/**
 * store.ts — Estado global da app, agora alimentado pelo Supabase.
 *
 * Mantém o mesmo padrão de useSyncExternalStore (React 18) para que
 * os componentes re-renderizem quando os dados mudam.
 *
 * O localStorage já não é usado como fonte de verdade — o Supabase é
 * a base de dados canónica. O store local é apenas uma cache em memória.
 */
import { useSyncExternalStore, useCallback } from 'react';
import type { AppState, Bank, BankData, Evaluation, EvaluationCycle, EvaluationStatus, AccessRequest } from './types';
import { CRITERIA, DEFAULT_DIMENSION_WEIGHTS } from './data';
import {
  fetchBanks, fetchDimensionWeights, fetchAllEvaluations,
  fetchVisibleEvaluations,
  upsertBank, deactivateBank, saveDimensionWeights,
  upsertCriterionScore, insertEvidence, deleteEvidence,
  updateEvaluationNotes, submitEvaluation, approveEvaluation,
  rejectEvaluation, createEvaluation,
  fetchCycles, createCycleDb, closeCycleDb,
  fetchAccessRequests, createAccessRequest as createAccessRequestDb,
  resolveAccessRequest as resolveAccessRequestDb, cancelAccessRequest as cancelAccessRequestDb,
} from './db';

// ── Estado inicial (vazio até carregar do Supabase) ───────────────────────────

const EMPTY_STATE: AppState = {
  banks: {},
  bankList: [],
  dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS },
  evaluations: [],
  cycles: [],
  activeCycleId: null,
  accessRequests: [],
};

let _state: AppState = { ...EMPTY_STATE };
let _loading = true;
let _selectCycleToken = 0;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(fn => fn());
}

function commit(next: Partial<AppState>) {
  _state = { ..._state, ...next };
  notify();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function evaluationToBankData(ev: Evaluation): BankData {
  return {
    id: ev.bankId,
    status: ev.status,
    notes: ev.notes,
    updatedAt: ev.updatedAt,
    criterionScores: ev.criterionScores,
  };
}

function buildBanksMap(
  bankList: Bank[],
  evaluations: Evaluation[],
): Record<string, BankData> {
  const banks: Record<string, BankData> = {};
  bankList.forEach(bank => {
    const ev = evaluations
      .filter(e => e.bankId === bank.id)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { approved: 0, submitted: 1, rejected: 2, draft: 3 };
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      })[0];
    if (ev) {
      banks[bank.id] = evaluationToBankData(ev);
    } else {
      banks[bank.id] = {
        id: bank.id,
        status: 'draft',
        notes: '',
        updatedAt: '',
        criterionScores: CRITERIA.reduce((acc, c) => {
          acc[c.id] = { score: 0, observations: '', device: '', answered: false, evidences: [] };
          return acc;
        }, {} as BankData['criterionScores']),
      };
    }
  });
  return banks;
}

// ── Carregamento inicial ──────────────────────────────────────────────────────

/** Carrega todos os dados do Supabase. Chamado pelo AppLayout após auth. */
export async function loadFromSupabase(isGestor: boolean): Promise<void> {
  try {
    const [bankList, dimensionWeights, cycles] = await Promise.all([
      fetchBanks(),
      fetchDimensionWeights(),
      fetchCycles(),
    ]);

    const activeCycle = cycles.find(c => c.status === 'open') ?? cycles[0] ?? null;
    const activeCycleId = activeCycle?.id ?? null;

    const [evaluations, accessRequests] = activeCycleId
      ? await Promise.all([
          isGestor
            ? fetchAllEvaluations(activeCycleId)
            : fetchVisibleEvaluations(activeCycleId),
          fetchAccessRequests(activeCycleId).catch(() => [] as AccessRequest[]),
        ])
      : [[], []];

    const banks = buildBanksMap(bankList, evaluations);

    _loading = false;
    commit({
      bankList,
      dimensionWeights,
      banks,
      evaluations,
      cycles,
      activeCycleId,
      accessRequests,
    });
  } catch (err) {
    console.error('[store] Erro ao carregar do Supabase:', err);
    _loading = false;
    notify();
  }
}

export function isLoading() {
  return _loading;
}

// ── useSyncExternalStore ──────────────────────────────────────────────────────

function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function getSnapshot() {
  return _state;
}

export function getState(): AppState {
  return _state;
}

// ── Hooks React ───────────────────────────────────────────────────────────────

export function useSnapshot(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  // ── Criterion scores ─────────────────────────────────────────────────────

  const updateCriterionScore = useCallback(async (
    evaluationId: string,
    criterionId: string,
    patch: Partial<{ score: number; observations: string; device: string; answered: boolean }>,
  ) => {
    // 1) Atualização OTIMISTA da cache local — síncrona e pela ordem das teclas,
    //    para o input refletir de imediato (evita que o texto reverta).
    const ev = _state.evaluations.find(e => e.id === evaluationId);
    if (ev) {
      const updatedEv: Evaluation = {
        ...ev,
        updatedAt: new Date().toISOString(),
        criterionScores: {
          ...ev.criterionScores,
          [criterionId]: { ...(ev.criterionScores[criterionId] ?? { score: 0, observations: '', device: '', answered: false, evidences: [] }), ...patch },
        },
      };
      const evaluations = _state.evaluations.map(e => e.id === evaluationId ? updatedEv : e);
      commit({ evaluations, banks: { ..._state.banks, [ev.bankId]: evaluationToBankData(updatedEv) } });
    }
    // 2) Persistir na BD a seguir (sem bloquear o ecrã).
    try {
      await upsertCriterionScore(evaluationId, criterionId, patch);
    } catch (err) {
      console.error('[store] Erro ao guardar critério:', err);
    }
  }, []);

  const addEvidence = useCallback(async (
    evaluationId: string,
    criterionId: string,
    ev: { type: 'link' | 'note' | 'image'; content: string; description: string; tags: string[] },
  ) => {
    const id = await insertEvidence(evaluationId, criterionId, ev);
    const evaluation = _state.evaluations.find(e => e.id === evaluationId);
    if (!evaluation) return;
    const cs = evaluation.criterionScores[criterionId] ?? { score: 0, observations: '', device: '', answered: false, evidences: [] };
    const newEvidence = {
      id,
      evaluationId,
      criterionId,
      type: ev.type,
      content: ev.content,
      description: ev.description,
      collectedAt: new Date().toISOString(),
      tags: ev.tags as never,
    };
    const updatedEv: Evaluation = {
      ...evaluation,
      criterionScores: {
        ...evaluation.criterionScores,
        [criterionId]: { ...cs, evidences: [...cs.evidences, newEvidence] },
      },
    };
    const evaluations = _state.evaluations.map(e => e.id === evaluationId ? updatedEv : e);
    commit({ evaluations, banks: { ..._state.banks, [updatedEv.bankId]: evaluationToBankData(updatedEv) } });
  }, []);

  const removeEvidence = useCallback(async (evaluationId: string, criterionId: string, evidenceId: string) => {
    await deleteEvidence(evidenceId);
    const evaluation = _state.evaluations.find(e => e.id === evaluationId);
    if (!evaluation) return;
    const cs = evaluation.criterionScores[criterionId];
    if (!cs) return;
    const updatedEv: Evaluation = {
      ...evaluation,
      criterionScores: {
        ...evaluation.criterionScores,
        [criterionId]: { ...cs, evidences: cs.evidences.filter(e => e.id !== evidenceId) },
      },
    };
    const evaluations = _state.evaluations.map(e => e.id === evaluationId ? updatedEv : e);
    commit({ evaluations, banks: { ..._state.banks, [updatedEv.bankId]: evaluationToBankData(updatedEv) } });
  }, []);

  // ── Bank meta ────────────────────────────────────────────────────────────

  const updateBankNotes = useCallback(async (evaluationId: string, notes: string) => {
    await updateEvaluationNotes(evaluationId, notes);
    const evaluations = _state.evaluations.map(e =>
      e.id === evaluationId ? { ...e, notes } : e
    );
    commit({ evaluations });
  }, []);

  // ── Avaliação CRUD ────────────────────────────────────────────────────────

  const startEvaluation = useCallback(async (bankId: string, currentUserId?: string): Promise<Evaluation | null> => {
    const cycleId = _state.activeCycleId;
    if (!cycleId) return null;
    const existing = _state.evaluations.find(
      e => e.bankId === bankId && e.cycleId === cycleId && ['draft', 'rejected'].includes(e.status)
    );
    if (existing) {
      if (currentUserId && existing.agenteId !== currentUserId) return null;
      return existing;
    }
    const ev = await createEvaluation(bankId, cycleId);
    if (!ev) return null;
    commit({
      evaluations: [..._state.evaluations, ev],
      banks: { ..._state.banks, [bankId]: evaluationToBankData(ev) },
    });
    return ev;
  }, []);

  const submitForReview = useCallback(async (evaluationId: string) => {
    await submitEvaluation(evaluationId);
    const evaluations = _state.evaluations.map(e =>
      e.id === evaluationId
        ? { ...e, status: 'submitted' as EvaluationStatus, submittedAt: new Date().toISOString(), rejectionComment: '' }
        : e
    );
    const ev = _state.evaluations.find(e => e.id === evaluationId);
    if (ev) {
      const submittedBankData: BankData = { ...evaluationToBankData(ev), status: 'submitted' };
      commit({ evaluations, banks: { ..._state.banks, [ev.bankId]: submittedBankData } });
    } else {
      commit({ evaluations });
    }
  }, []);

  const approve = useCallback(async (evaluationId: string) => {
    await approveEvaluation(evaluationId);
    const evaluations = _state.evaluations.map(e =>
      e.id === evaluationId ? { ...e, status: 'approved' as EvaluationStatus, reviewedAt: new Date().toISOString() } : e
    );
    // Actualizar banco no mapa de banks para o ranking
    const ev = _state.evaluations.find(e => e.id === evaluationId);
    if (ev) {
      const approvedBankData: BankData = { ...evaluationToBankData(ev), status: 'approved' };
      commit({ evaluations, banks: { ..._state.banks, [ev.bankId]: approvedBankData } });
    } else {
      commit({ evaluations });
    }
  }, []);

  const reject = useCallback(async (evaluationId: string, comment: string) => {
    await rejectEvaluation(evaluationId, comment);
    const evaluations = _state.evaluations.map(e =>
      e.id === evaluationId
        ? { ...e, status: 'rejected' as EvaluationStatus, rejectionComment: comment, reviewedAt: new Date().toISOString() }
        : e
    );
    const ev = _state.evaluations.find(e => e.id === evaluationId);
    if (ev) {
      const rejectedBankData: BankData = { ...evaluationToBankData(ev), status: 'rejected' };
      commit({ evaluations, banks: { ..._state.banks, [ev.bankId]: rejectedBankData } });
    } else {
      commit({ evaluations });
    }
  }, []);

  // ── Banks CRUD (gestor) ───────────────────────────────────────────────────

  const addBank = useCallback(async (bank: Bank) => {
    await upsertBank(bank);
    const bankList = [..._state.bankList, bank];
    const banks = { ..._state.banks, [bank.id]: {
      id: bank.id, status: 'draft' as EvaluationStatus, notes: '', updatedAt: '',
      criterionScores: CRITERIA.reduce((acc, c) => {
        acc[c.id] = { score: 0, observations: '', device: '', answered: false, evidences: [] };
        return acc;
      }, {} as BankData['criterionScores']),
    }};
    commit({ bankList, banks });
  }, []);

  const updateBankRecord = useCallback(async (bankId: string, patch: Partial<{ name: string; shortName: string }>) => {
    const bank = _state.bankList.find(b => b.id === bankId);
    if (!bank) return;
    const updated = { ...bank, ...patch };
    await upsertBank(updated);
    commit({ bankList: _state.bankList.map(b => b.id === bankId ? updated : b) });
  }, []);

  const removeBank = useCallback(async (bankId: string) => {
    await deactivateBank(bankId);
    const { [bankId]: _, ...remainingBanks } = _state.banks;
    commit({
      bankList: _state.bankList.filter(b => b.id !== bankId),
      banks: remainingBanks,
    });
  }, []);

  // ── Pesos das dimensões (gestor) ──────────────────────────────────────────

  const updateDimensionWeights = useCallback(async (weights: Record<string, number>) => {
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    if (Math.round(total) !== 100) return;
    await saveDimensionWeights(weights);
    commit({ dimensionWeights: weights });
  }, []);

  // ── Ciclos de avaliação (gestor) ──────────────────────────────────────────

  const createCycle = useCallback(async (name: string) => {
    if (_state.cycles.some(c => c.status === 'open')) {
      throw new Error('Já existe um ciclo aberto. Feche-o antes de criar um novo.');
    }
    const cycle: EvaluationCycle = await createCycleDb(name);
    const cycles = [cycle, ..._state.cycles];
    commit({ cycles, activeCycleId: cycle.id, evaluations: [], banks: buildBanksMap(_state.bankList, []) });
  }, []);

  const closeCycle = useCallback(async (cycleId: string) => {
    await closeCycleDb(cycleId);
    const cycles = _state.cycles.map(c =>
      c.id === cycleId ? { ...c, status: 'closed' as const, closedAt: new Date().toISOString() } : c
    );
    commit({ cycles });
  }, []);

  const selectCycle = useCallback(async (cycleId: string, isGestor: boolean) => {
    const token = ++_selectCycleToken;
    const [evaluations, accessRequests] = await Promise.all([
      isGestor
        ? fetchAllEvaluations(cycleId)
        : fetchVisibleEvaluations(cycleId),
      fetchAccessRequests(cycleId).catch(() => [] as AccessRequest[]),
    ]);
    if (token !== _selectCycleToken) return;
    const banks = buildBanksMap(_state.bankList, evaluations);
    commit({ activeCycleId: cycleId, evaluations, banks, accessRequests });
  }, []);

  // ── Refresh de avaliações (para sincronizar estado stale) ─────────────

  const refreshEvaluations = useCallback(async (isGestor: boolean) => {
    const cycleId = _state.activeCycleId;
    if (!cycleId) return;
    const token = ++_selectCycleToken;
    const [evaluations, accessRequests] = await Promise.all([
      isGestor
        ? fetchAllEvaluations(cycleId)
        : fetchVisibleEvaluations(cycleId),
      fetchAccessRequests(cycleId).catch(() => [] as AccessRequest[]),
    ]);
    if (token !== _selectCycleToken) return;
    const banks = buildBanksMap(_state.bankList, evaluations);
    commit({ evaluations, banks, accessRequests });
  }, []);

  // ── Pedidos de acesso ────────────────────────────────────────────────────

  const requestAccess = useCallback(async (evaluationId: string) => {
    const req = await createAccessRequestDb(evaluationId);
    commit({ accessRequests: [req, ..._state.accessRequests] });
    return req;
  }, []);

  const resolveAccess = useCallback(async (requestId: string, decision: 'approved' | 'rejected', comment?: string) => {
    await resolveAccessRequestDb(requestId, decision, comment);
    const accessRequests = _state.accessRequests.map(r =>
      r.id === requestId
        ? { ...r, status: decision, resolvedAt: new Date().toISOString(), comment: comment ?? '' }
        : r
    ) as typeof _state.accessRequests;

    if (decision === 'approved') {
      const req = _state.accessRequests.find(r => r.id === requestId);
      if (req) {
        const evaluations = _state.evaluations.map(e =>
          e.id === req.evaluationId ? { ...e, agenteId: req.requesterId } : e
        );
        const banks = buildBanksMap(_state.bankList, evaluations);
        commit({ accessRequests, evaluations, banks });
        return;
      }
    }
    commit({ accessRequests });
  }, []);

  const cancelAccess = useCallback(async (requestId: string) => {
    await cancelAccessRequestDb(requestId);
    commit({ accessRequests: _state.accessRequests.filter(r => r.id !== requestId) });
  }, []);

  return {
    state,
    updateCriterionScore,
    addEvidence,
    removeEvidence,
    updateBankNotes,
    startEvaluation,
    submitForReview,
    approve,
    reject,
    addBank,
    updateBankRecord,
    removeBank,
    updateDimensionWeights,
    createCycle,
    closeCycle,
    selectCycle,
    refreshEvaluations,
    requestAccess,
    resolveAccess,
    cancelAccess,
  };
}
