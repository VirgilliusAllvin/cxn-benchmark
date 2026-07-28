/**
 * db.ts — Funções de acesso à base de dados Supabase.
 * Usa bulk queries para minimizar o número de chamadas à API.
 */
import { supabase } from './supabase';
import type { Bank, Evaluation, CriterionScore, Evidence, EvaluationStatus, UserProfile, EvaluationCycle, CycleStatus, AccessRequest } from './types';
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
  cycle_id: string;
}

interface DbCriterionScore {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  score: number;
  observations: string;
  device: string;
  answered: boolean | null;
}

interface DbEvidence {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  type: 'link' | 'note' | 'image';
  content: string;
  description: string;
  collected_at: string;
  tags: string[];
}

interface DbEvaluationCycle {
  id: string;
  name: string;
  status: 'open' | 'closed';
  created_by: string;
  created_at: string;
  closed_at: string | null;
}

// ── RLS: escrita silenciosamente filtrada ───────────────────────────────────
//
// As policies RLS de escrita do agente (evaluations/criterion_scores/evidences)
// exigem `evaluation_cycles.status = 'open'` (entre outras condições). Quando
// essa condição falha, o Postgres/PostgREST NÃO devolve erro — o UPDATE/DELETE
// simplesmente não afecta nenhuma linha e `error` continua `null`. Sem verificar
// se alguma linha foi de facto afectada, a app assume sucesso e aplica a
// actualização optimista no estado local, ficando dessincronizada da BD
// (perda de dados silenciosa). Todas as funções sujeitas a esta condição RLS
// encadeiam `.select()` após o `.update()`/`.delete()` e usam este helper para
// detectar o caso de 0 linhas afectadas.
function assertRowsAffected(rows: unknown[] | null | undefined): void {
  if (!rows || rows.length === 0) {
    throw new Error('Não foi possível guardar: o ciclo pode estar fechado ou já não tem permissão para editar esta avaliação.');
  }
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
      // Retrocompat: linhas antigas sem a coluna → respondido se score>0
      answered: s.answered ?? s.score > 0,
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
    cycleId: row.cycle_id,
    criterionScores,
  };
}

// ── Bulk loader interno ───────────────────────────────────────────────────────

/** Dado uma lista de IDs de avaliação, carrega scores + evidências em 3 queries */
async function loadEvaluationsBulk(evalRows: DbEvaluation[]): Promise<Evaluation[]> {
  if (evalRows.length === 0) return [];
  const ids = evalRows.map(r => r.id);

  const [scRes, evidRes] = await Promise.all([
    supabase.from('criterion_scores').select('*').in('evaluation_id', ids),
    supabase.from('evidences').select('*').in('evaluation_id', ids),
  ]);

  const scores = (scRes.data ?? []) as DbCriterionScore[];
  const evidences = (evidRes.data ?? []) as DbEvidence[];

  return evalRows.map(row =>
    mapEvaluation(
      row,
      scores.filter(s => s.evaluation_id === row.id),
      evidences.filter(e => e.evaluation_id === row.id),
    )
  );
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

// ── Ciclos de avaliacao ──────────────────────────────────────────────────────

export async function fetchCycles(): Promise<EvaluationCycle[]> {
  const { data, error } = await supabase
    .from('evaluation_cycles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: DbEvaluationCycle) => ({
    id: r.id,
    name: r.name,
    status: r.status as CycleStatus,
    createdBy: r.created_by,
    createdAt: r.created_at,
    closedAt: r.closed_at ?? undefined,
  }));
}

export async function createCycleDb(name: string): Promise<EvaluationCycle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('evaluation_cycles')
    .insert({ name, status: 'open', created_by: user.id })
    .select('*')
    .single();
  if (error) throw error;
  const r = data as DbEvaluationCycle;
  return {
    id: r.id,
    name: r.name,
    status: r.status as CycleStatus,
    createdBy: r.created_by,
    createdAt: r.created_at,
    closedAt: r.closed_at ?? undefined,
  };
}

export async function closeCycleDb(cycleId: string): Promise<void> {
  const { error } = await supabase
    .from('evaluation_cycles')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', cycleId);
  if (error) throw error;
}

// ── Avaliações — bulk ─────────────────────────────────────────────────────────

/** Avaliações do agente actual (todas) — 1 query de avaliações + 2 bulk */
export async function fetchMyEvaluations(cycleId?: string): Promise<Evaluation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase
    .from('evaluations')
    .select('*')
    .eq('agente_id', user.id)
    .order('updated_at', { ascending: false });
  if (cycleId) query = query.eq('cycle_id', cycleId);
  const { data, error } = await query;
  if (error || !data) return [];
  return loadEvaluationsBulk(data as DbEvaluation[]);
}

/** Avaliações visíveis (para ranking/dashboard) — 1 query + 2 bulk */
export async function fetchVisibleEvaluations(cycleId?: string): Promise<Evaluation[]> {
  let query = supabase
    .from('evaluations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (cycleId) query = query.eq('cycle_id', cycleId);
  const { data, error } = await query;
  if (error || !data) return [];
  return loadEvaluationsBulk(data as DbEvaluation[]);
}

/** Todas as avaliações (gestor) — 1 query + 2 bulk */
export async function fetchAllEvaluations(cycleId?: string): Promise<Evaluation[]> {
  let query = supabase
    .from('evaluations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (cycleId) query = query.eq('cycle_id', cycleId);
  const { data, error } = await query;
  if (error || !data) return [];
  return loadEvaluationsBulk(data as DbEvaluation[]);
}

/** Avaliação individual por id (usada após criar/submeter) */
export async function fetchEvaluationById(evalId: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from('evaluations').select('*').eq('id', evalId).single();
  if (error || !data) return null;
  const evals = await loadEvaluationsBulk([data as DbEvaluation]);
  return evals[0] ?? null;
}

// ── Avaliação CRUD ────────────────────────────────────────────────────────────

export async function createEvaluation(bankId: string, cycleId: string): Promise<Evaluation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('evaluations')
    .insert({ bank_id: bankId, agente_id: user.id, status: 'draft', cycle_id: cycleId })
    .select('id')
    .single();
  if (error || !data) throw error;
  return fetchEvaluationById(data.id);
}

export async function upsertCriterionScore(
  evaluationId: string,
  criterionId: string,
  patch: Partial<{ score: number; observations: string; device: string; answered: boolean }>,
): Promise<void> {
  const { data, error } = await supabase.from('criterion_scores').upsert(
    { evaluation_id: evaluationId, criterion_id: criterionId, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'evaluation_id,criterion_id' },
  ).select('id');
  if (error) throw error;
  assertRowsAffected(data);
  await supabase.from('evaluations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', evaluationId);
}

/** Carrega uma imagem para o bucket 'evidences' e devolve o URL público. */
export async function uploadEvidenceImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('evidences').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('evidences').getPublicUrl(path);
  return data.publicUrl;
}

export async function insertEvidence(
  evaluationId: string,
  criterionId: string,
  ev: { type: 'link' | 'note' | 'image'; content: string; description: string; tags: string[] },
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

export async function deleteEvidence(evidenceId: string): Promise<void> {
  const { data, error } = await supabase.from('evidences').delete().eq('id', evidenceId).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function updateEvaluationNotes(evaluationId: string, notes: string): Promise<void> {
  const { data, error } = await supabase.from('evaluations')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', evaluationId)
    .select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export async function submitEvaluation(evaluationId: string): Promise<void> {
  const { data, error } = await supabase.from('evaluations').update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rejection_comment: '',
  }).eq('id', evaluationId).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function approveEvaluation(evaluationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('evaluations').update({
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    gestor_id: user?.id,
    rejection_comment: '',
  }).eq('id', evaluationId).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function rejectEvaluation(evaluationId: string, comment: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('evaluations').update({
    status: 'rejected',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    gestor_id: user?.id,
    rejection_comment: comment,
  }).eq('id', evaluationId).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

// ── Pedidos de acesso ──────────────────────────────────────────────────────

interface DbAccessRequest {
  id: string;
  evaluation_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  comment: string;
}

function mapAccessRequest(row: DbAccessRequest, requesterName?: string): AccessRequest {
  return {
    id: row.id,
    evaluationId: row.evaluation_id,
    requesterId: row.requester_id,
    requesterName,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    comment: row.comment,
  };
}

export async function fetchAccessRequests(cycleId?: string): Promise<AccessRequest[]> {
  if (cycleId) {
    const { data: evalRows } = await supabase
      .from('evaluations')
      .select('id')
      .eq('cycle_id', cycleId);
    const evalIds = (evalRows ?? []).map(r => r.id);
    if (evalIds.length === 0) return [];

    const { data, error } = await supabase
      .from('access_requests')
      .select('*, requester:profiles!requester_id(name)')
      .in('evaluation_id', evalIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => {
      const requesterName = (row.requester as Record<string, unknown> | null)?.name as string | undefined;
      return mapAccessRequest(row as unknown as DbAccessRequest, requesterName);
    });
  }

  const { data, error } = await supabase
    .from('access_requests')
    .select('*, requester:profiles!requester_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const requesterName = (row.requester as Record<string, unknown> | null)?.name as string | undefined;
    return mapAccessRequest(row as unknown as DbAccessRequest, requesterName);
  });
}

export async function createAccessRequest(evaluationId: string): Promise<AccessRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('access_requests')
    .insert({ evaluation_id: evaluationId, requester_id: user.id })
    .select('*, requester:profiles!requester_id(name)')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um pedido de acesso pendente para esta avaliação.');
    throw error;
  }
  const requesterName = (data.requester as Record<string, unknown> | null)?.name as string | undefined;
  return mapAccessRequest(data as unknown as DbAccessRequest, requesterName);
}

export async function resolveAccessRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  comment?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('access_requests')
    .update({
      status: decision,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      comment: comment ?? '',
    })
    .eq('id', requestId)
    .select('id, evaluation_id, requester_id')
    .single();
  if (error) throw error;

  if (decision === 'approved') {
    const { error: transferErr } = await supabase
      .from('evaluations')
      .update({
        agente_id: data.requester_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.evaluation_id)
      .select('id');
    if (transferErr) throw transferErr;
  }
}

export async function cancelAccessRequest(requestId: string): Promise<void> {
  const { data, error } = await supabase
    .from('access_requests')
    .delete()
    .eq('id', requestId)
    .select('id');
  if (error) throw error;
  assertRowsAffected(data);
}
