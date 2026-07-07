import type { Tag } from './data';

// ── Auth / Users ──────────────────────────────────────────────────────────────

export type UserRole = 'agente' | 'gestor';
export type EvaluationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
}

// ── Evaluation Cycle ──────────────────────────────────────────────────────────

export type CycleStatus = 'open' | 'closed';

export interface EvaluationCycle {
  id: string;
  name: string;
  status: CycleStatus;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface Evidence {
  id: string;
  evaluationId: string;
  criterionId: string;
  type: 'link' | 'note' | 'image';
  content: string;
  description: string;
  collectedAt: string;   // ISO
  tags: Tag[];
}

// ── Criterion Score ───────────────────────────────────────────────────────────

export interface CriterionScore {
  score: number;         // binary: 0 or 5; scalar: 0 (not evaluated) or 1–5
  observations: string;
  device: string;
  answered: boolean;     // distingue "respondeu Não (0)" de "ainda não respondeu"
  evidences: Evidence[];
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export interface Evaluation {
  id: string;
  bankId: string;
  cycleId: string;
  agenteId: string;
  status: EvaluationStatus;
  notes: string;
  rejectionComment: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  gestorId?: string;
  criterionScores: Record<string, CriterionScore>; // keyed by criterion.id
}

// ── Bank ──────────────────────────────────────────────────────────────────────

export interface Bank {
  id: string;
  name: string;
  shortName: string;
  active?: boolean;
}

// ── App State (client-side cache) ─────────────────────────────────────────────

/** Lightweight BankData used by calculations — derived from Evaluation */
export interface BankData {
  id: string;
  status: EvaluationStatus;
  notes: string;
  updatedAt: string;
  criterionScores: Record<string, CriterionScore>;
}

export type AppState = {
  /** evaluations indexed by bank_id — only the most recent approved (or own draft) */
  banks: Record<string, BankData>;
  bankList: Bank[];
  dimensionWeights: Record<string, number>; // dimensionId → percentage (0-100)
  /** All evaluations loaded (for gestor review queue) */
  evaluations: Evaluation[];
  cycles: EvaluationCycle[];
  activeCycleId: string | null;
};
