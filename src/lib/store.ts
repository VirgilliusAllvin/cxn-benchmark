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
import type { AppState, Bank, BankData, Evaluation, EvaluationStatus } from './types';
import { CRITERIA, DEFAULT_DIMENSION_WEIGHTS } from './data';
import {
  fetchBanks, fetchDimensionWeights, fetchAllEvaluations,
  fetchMyEvaluations, fetchApprovedEvaluations,
  upsertBank, deactivateBank, saveDimensionWeights,
  upsertCriterionScore, insertEvidence, deleteEvidence,
  updateEvaluationNotes, submitEvaluation, approveEvaluation,
  rejectEvaluation, createEvaluation,
} from './db';

// ── Estado inicial (vazio até carregar do Supabase) ───────────────────────────

const EMPTY_STATE: AppState = {
  banks: {},
  bankList: [],
  dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS },
  evaluations: [],
};

let _state: AppState = { ...EMPTY_STATE };
let _loading = true;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(fn => fn());
}

function commit(next: Partial<AppState>) {
  _state = { ..._state, ...next };
  notify();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function evaluationToBankData(ev: Evaluation): BankData {
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
  approvedEvals: Evaluation[],
  myEvals: Evaluation[],
): Record<string, BankData> {
  const banks: Record<string, BankData> = {};
  bankList.forEach(bank => {
    // Aprovada tem prioridade; se não, mostrar a própria (draft/rejected)
    const approved = approvedEvals.find(e => e.bankId === bank.id);
    const mine     = myEvals.find(e => e.bankId === bank.id);
    const ev       = approved ?? mine;
    if (ev) {
      banks[bank.id] = evaluationToBankData(ev);
    } else {
      banks[bank.id] = {
        id: bank.id,
        status: 'draft',
        notes: '',
        updatedAt: '',
        criterionScores: CRITERIA.reduce((acc, c) => {
          acc[c.id] = { score: 0, observations: '', device: '', evidences: [] };
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
    // 3 queries em paralelo (em vez de 35+)
    const [bankList, dimensionWeights, myEvals, approvedEvals, allEvals] = await Promise.all([
      fetchBanks(),
      fetchDimensionWeights(),
      isGestor ? Promise.resolve([]) : fetchMyEvaluations(),
      fetchApprovedEvaluations(),
      isGestor ? fetchAllEvaluations() : Promise.resolve([]),
    ]);

    const banks = buildBanksMap(bankList, approvedEvals, myEvals);

    _loading = false;
    commit({
      bankList,
      dimensionWeights,
      banks,
      evaluations: isGestor ? allEvals : myEvals,
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
    patch: Partial<{ score: number; observations: string; device: string }>,
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
          [criterionId]: { ...(ev.criterionScores[criterionId] ?? { score: 0, observations: '', device: '', evidences: [] }), ...patch },
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
    const cs = evaluation.criterionScores[criterionId] ?? { score: 0, observations: '', device: '', evidences: [] };
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

  const startEvaluation = useCallback(async (bankId: string): Promise<Evaluation | null> => {
    // Verificar se já existe uma avaliação draft/rejected para este banco
    const existing = _state.evaluations.find(
      e => e.bankId === bankId && ['draft', 'rejected'].includes(e.status)
    );
    if (existing) return existing;
    const ev = await createEvaluation(bankId);
    if (!ev) return null;
    commit({ evaluations: [..._state.evaluations, ev] });
    return ev;
  }, []);

  const submitForReview = useCallback(async (evaluationId: string) => {
    await submitEvaluation(evaluationId);
    const evaluations = _state.evaluations.map(e =>
      e.id === evaluationId ? { ...e, status: 'submitted' as EvaluationStatus, submittedAt: new Date().toISOString() } : e
    );
    commit({ evaluations });
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
    commit({ evaluations });
  }, []);

  // ── Banks CRUD (gestor) ───────────────────────────────────────────────────

  const addBank = useCallback(async (bank: Bank) => {
    await upsertBank(bank);
    const bankList = [..._state.bankList, bank];
    const banks = { ..._state.banks, [bank.id]: {
      id: bank.id, status: 'draft' as EvaluationStatus, notes: '', updatedAt: '',
      criterionScores: CRITERIA.reduce((acc, c) => {
        acc[c.id] = { score: 0, observations: '', device: '', evidences: [] };
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
  };
}
