/**
 * db.ts — Funções de acesso à base de dados Supabase.
 * Cada função devolve dados tipados ou lança erro.
 */
import { supabase } from './supabase';
import type { Bank, Evaluation, CriterionScore, Evidence, EvaluationStatus, UserProfile } from './types';
import { DEFAULT_DIMENSION_WEIGHTS } from './data';

// ── Tipos de linha Supabase ───────────────────────────────────────────────────

interface DbEvaluation {
  id: string;
  bank_id: string;
  agente_id: string;
  status: EvaluationStatus;
  notes: string;
  rejection_comment: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  gestor_id: string | null;
}

interface DbCriterionScore {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  score: number;
  observations: string;
  device: string;
}

interface DbEvidence {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  type: 'link' | 'note';
  content: string;
  description: string;
  collected_at: string;
  tags: string[];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapEvidence(row: DbEvidence): Evidence {
  return {
    id: row.id,
    evaluationId: row.evaluation_id,
    criterionId: row.criterion_id,
    type: row.type,
    content: row.content,
    description: row.description,
    collectedAt: row.collected_at,
    tags: (row.tags ?? []) as Evidence['tags'],
  };
}

function mapEvaluation(
  row: DbEvaluation,
  scores: DbCriterionScore[],
  evidences: DbEvidence[],
): Evaluation {
  const criterionScores: Record<string, CriterionScore> = {};
  scores.forEach(s => {
    criterionScores[s.criterion_id] = {
      score: s.score,
      observations: s.observations,
      device: s.device,
      evidences: evidences.filter(e => e.criterion_id === s.criterion_id).map(mapEvidence),
    };
  });
  return {
    id: row.id,
    bankId: row.bank_id,
    agenteId: row.agente_id,
    status: row.status,
    notes: row.notes,
    rejectionComment: row.rejection_comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    gestorId: row.gestor_id ?? undefined,
    criterionScores,
  };
}

// ── Perfil ────────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return { id: data.id, name: data.name, role: data.role as UserProfile['role'] };
}

// ── Bancos ────────────────────────────────────────────────────────────────────

export async function fetchBanks(): Promise<Bank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('id, name, short_name, active')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(b => ({ id: b.id, name: b.name, shortName: b.short_name, active: b.active }));
}

export async function upsertBank(bank: Bank): Promise<void> {
  const { error } = await supabase.from('banks').upsert({
    id: bank.id,
    name: bank.name,
    short_name: bank.shortName,
    active: bank.active ?? true,
  });
  if (error) throw error;
}

export async function deactivateBank(bankId: string): Promise<void> {
  const { error } = await supabase.from('banks').update({ active: false }).eq('id', bankId);
  if (error) throw error;
}

// ── Config (pesos) ────────────────────────────────────────────────────────────

export async function fetchDimensionWeights(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'dimension_weights')
    .single();
  if (error || !data) return { ...DEFAULT_DIMENSION_WEIGHTS };
  return data.value as Record<string, number>;
}

export async function saveDimensionWeights(weights: Record<string, number>): Promise<void> {
  const { error } = await supabase.from('app_config').upsert({
    key: 'dimension_weights',
    value: weights,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Avaliações ────────────────────────────────────────────────────────────────

/** Carrega avaliação completa (scores + evidências) por id */
async function fetchEvaluationById(evalId: string): Promise<Evaluation | null> {
  const [evRes, scRes, evidRes] = await Promise.all([
    supabase.from('evaluations').select('*').eq('id', evalId).single(),
    supabase.from('criterion_scores').select('*').eq('evaluation_id', evalId),
    supabase.from('evidences').select('*').eq('evaluation_id', evalId),
  ]);
  if (evRes.error || !evRes.data) return null;
  return mapEvaluation(evRes.data, scRes.data ?? [], evidRes.data ?? []);
}

/** Avaliação do agente para um banco (própria) */
export async function fetchMyEvaluationForBank(bankId: string): Promise<Evaluation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('evaluations')
    .select('id')
    .eq('bank_id', bankId)
    .eq('agente_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return fetchEvaluationById(data.id);
}

/** Avaliação aprovada para um banco (para o ranking/dashboard) */
export async function fetchApprovedEvaluationForBank(bankId: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('id')
    .eq('bank_id', bankId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return fetchEvaluationById(data.id);
}

/** Todas as avaliações (para o gestor — fila de revisão) */
export async function fetchAllEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('id')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  const evals = await Promise.all(data.map(row => fetchEvaluationById(row.id)));
  return evals.filter((e): e is Evaluation => e !== null);
}

/** Cria uma nova avaliação em draft para um banco */
export async function createEvaluation(bankId: string): Promise<Evaluation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('evaluations')
    .insert({ bank_id: bankId, agente_id: user.id, status: 'draft' })
    .select('id')
    .single();
  if (error || !data) throw error;
  return fetchEvaluationById(data.id);
}

/** Guarda (upsert) o score de um critério */
export async function upsertCriterionScore(
  evaluationId: string,
  criterionId: string,
  patch: Partial<{ score: number; observations: string; device: string }>,
): Promise<void> {
  const { error } = await supabase.from('criterion_scores').upsert(
    {
      evaluation_id: evaluationId,
      criterion_id: criterionId,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: 'evaluation_id,criterion_id' },
  );
  if (error) throw error;
  // actualiza updated_at na avaliação
  await supabase.from('evaluations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', evaluationId);
}

/** Adiciona evidência */
export async function insertEvidence(
  evaluationId: string,
  criterionId: string,
  ev: { type: 'link' | 'note'; content: string; description: string; tags: string[] },
): Promise<string> {
  const { data, error } = await supabase.from('evidences').insert({
    evaluation_id: evaluationId,
    criterion_id: criterionId,
    type: ev.type,
    content: ev.content,
    description: ev.description,
    tags: ev.tags,
    collected_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

/** Remove evidência */
export async function deleteEvidence(evidenceId: string): Promise<void> {
  const { error } = await supabase.from('evidences').delete().eq('id', evidenceId);
  if (error) throw error;
}

/** Actualiza notas da avaliação */
export async function updateEvaluationNotes(evaluationId: string, notes: string): Promise<void> {
  const { error } = await supabase.from('evaluations')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', evaluationId);
  if (error) throw error;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

/** Agente submete avaliação para revisão */
export async function submitEvaluation(evaluationId: string): Promise<void> {
  const { error } = await supabase.from('evaluations').update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rejection_comment: '',
  }).eq('id', evaluationId);
  if (error) throw error;
}

/** Gestor aprova avaliação */
export async function approveEvaluation(evaluationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('evaluations').update({
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    gestor_id: user?.id,
    rejection_comment: '',
  }).eq('id', evaluationId);
  if (error) throw error;
}

/** Gestor rejeita avaliação com comentário */
export async function rejectEvaluation(evaluationId: string, comment: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('evaluations').update({
    status: 'rejected',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    gestor_id: user?.id,
    rejection_comment: comment,
  }).eq('id', evaluationId);
  if (error) throw error;
}
