# Evaluation Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce evaluation cycles so the gestor controls when evaluations happen, each bank gets exactly one evaluation per cycle, and visibility follows the draft/submitted/approved model.

**Architecture:** New `evaluation_cycles` table with FK from `evaluations`. RLS policies enforce visibility (draft=private, submitted/approved=public). Store loads evaluations filtered by active cycle. UI shows cycle context everywhere.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth)

**Spec:** `docs/superpowers/specs/2026-07-06-evaluation-cycle-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `supabase/schema.sql` | Add `evaluation_cycles` table, alter `evaluations`, replace RLS policies |
| Modify | `src/lib/types.ts` | Add `EvaluationCycle` interface, `cycleId` to `Evaluation`, update `AppState` |
| Modify | `src/lib/db.ts` | CRUD for cycles, filter evaluations by cycle_id |
| Modify | `src/lib/store.ts` | Load cycles, `activeCycleId`, `selectCycle`, `createCycle`, `closeCycle` |
| Modify | `src/pages/Configuracoes.tsx` | Cycle management section (create, close, list) |
| Modify | `src/pages/Avaliacao.tsx` | Cycle guard, bank availability badges |
| Modify | `src/pages/Revisao.tsx` | Filter by active cycle |
| Modify | `src/pages/Dashboard.tsx` | Cycle selector dropdown |
| Modify | `src/pages/Ranking.tsx` | Cycle selector dropdown |
| Modify | `src/pages/Banks.tsx` | Status badge per bank in active cycle |
| Modify | `src/pages/BankDetail.tsx` | Read from cycle-scoped data |
| Create | `supabase/migrations/001_evaluation_cycles.sql` | Migration SQL for user to run |

---

### Task 0: Push pending commits

**Files:** None (git only)

This task pushes the 4 unpushed commits (48f26bb through 628c27b) to GitHub so Vercel deploys the latest fixes.

- [ ] **Step 1: Push to remote**

```bash
git push origin master
```

Expected: 4 commits pushed, Vercel triggers deploy.

---

### Task 1: Schema and migration SQL

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/001_evaluation_cycles.sql`

- [ ] **Step 1: Update schema.sql with evaluation_cycles table**

Add the `evaluation_cycles` table definition after the `app_config` section and before `evaluations`. Add `cycle_id` column to `evaluations`. Replace all RLS policies with the new ones from the spec.

In `supabase/schema.sql`, add after the `app_config` policies:

```sql
-- ── Ciclos de avaliacao ──────────────────────────────────────
create table if not exists evaluation_cycles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     text not null default 'open'
               check (status in ('open', 'closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  closed_at  timestamptz
);
alter table evaluation_cycles enable row level security;

create policy "Todos leem ciclos"
  on evaluation_cycles for select
  using (auth.role() = 'authenticated');

create policy "Gestor gere ciclos"
  on evaluation_cycles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));
```

In the `evaluations` table definition, add `cycle_id` column:

```sql
  cycle_id           uuid references evaluation_cycles(id),
```

Add unique constraint:

```sql
  unique(cycle_id, bank_id)
```

Replace the evaluations RLS policies with:

```sql
create policy "Agente ve as suas avaliacoes"
  on evaluations for select using (agente_id = auth.uid());

create policy "Todos veem submitted e approved"
  on evaluations for select using (status in ('submitted', 'approved'));

create policy "Gestor ve todas as avaliacoes"
  on evaluations for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente cria avaliacao"
  on evaluations for insert with check (
    agente_id = auth.uid()
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

create policy "Agente edita draft/rejected"
  on evaluations for update using (
    agente_id = auth.uid()
    and status in ('draft', 'rejected')
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

create policy "Gestor actualiza qualquer avaliacao"
  on evaluations for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );
```

Replace criterion_scores RLS policies with:

```sql
create policy "Agente le scores da sua avaliacao"
  on criterion_scores for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Todos leem scores submitted/approved"
  on criterion_scores for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved'))
  );

create policy "Gestor le todos os scores"
  on criterion_scores for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve scores draft/rejected"
  on criterion_scores for all using (
    exists (
      select 1 from evaluations e
      join evaluation_cycles c on c.id = e.cycle_id
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
        and c.status = 'open'
    )
  );

create policy "Gestor escreve qualquer score"
  on criterion_scores for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );
```

Replace evidences RLS policies with:

```sql
create policy "Agente le evidencias da sua avaliacao"
  on evidences for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Todos leem evidencias submitted/approved"
  on evidences for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved'))
  );

create policy "Gestor le todas as evidencias"
  on evidences for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve evidencias draft/rejected"
  on evidences for all using (
    exists (
      select 1 from evaluations e
      join evaluation_cycles c on c.id = e.cycle_id
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
        and c.status = 'open'
    )
  );

create policy "Gestor escreve qualquer evidencia"
  on evidences for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );
```

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/001_evaluation_cycles.sql` with the SQL the user must run on Supabase to migrate from the current schema:

```sql
-- ============================================================
-- Migration: Evaluation Cycles
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create evaluation_cycles table
create table if not exists evaluation_cycles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     text not null default 'open'
               check (status in ('open', 'closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  closed_at  timestamptz
);
alter table evaluation_cycles enable row level security;

create policy "Todos leem ciclos"
  on evaluation_cycles for select
  using (auth.role() = 'authenticated');

create policy "Gestor gere ciclos"
  on evaluation_cycles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));

-- 2. Add cycle_id to evaluations (nullable for now)
alter table evaluations add column if not exists cycle_id uuid references evaluation_cycles(id);

-- 3. Create "Ciclo Inicial" and assign all existing evaluations
do $$
declare
  v_cycle_id uuid;
begin
  insert into evaluation_cycles (name, status, created_at)
  values ('Ciclo Inicial', 'open', now())
  returning id into v_cycle_id;

  update evaluations set cycle_id = v_cycle_id;

  -- Remove duplicates: keep the most recent evaluation per bank
  delete from evaluations
  where id not in (
    select distinct on (bank_id) id
    from evaluations
    where cycle_id = v_cycle_id
    order by bank_id, updated_at desc
  );
end $$;

-- 4. Make cycle_id NOT NULL and add unique constraint
alter table evaluations alter column cycle_id set not null;
alter table evaluations add constraint uq_evaluation_per_bank_per_cycle unique (cycle_id, bank_id);

-- 5. Drop old RLS policies on evaluations
drop policy if exists "Agente ve as suas avaliacoes" on evaluations;
drop policy if exists "Agente ve as suas avaliações" on evaluations;
drop policy if exists "Gestor ve todas as avaliacoes" on evaluations;
drop policy if exists "Gestor vê todas as avaliações" on evaluations;
drop policy if exists "Todos leem avaliacoes aprovadas" on evaluations;
drop policy if exists "Todos leem avaliações aprovadas" on evaluations;
drop policy if exists "Agente cria avaliacao" on evaluations;
drop policy if exists "Agente cria avaliação" on evaluations;
drop policy if exists "Agente edita a sua avaliacao (draft/rejected)" on evaluations;
drop policy if exists "Agente edita a sua avaliação (draft/rejected)" on evaluations;
drop policy if exists "Gestor actualiza qualquer avaliacao" on evaluations;
drop policy if exists "Gestor actualiza qualquer avaliação" on evaluations;

-- 6. Create new evaluations policies
create policy "Agente ve as suas avaliacoes"
  on evaluations for select using (agente_id = auth.uid());

create policy "Todos veem submitted e approved"
  on evaluations for select using (status in ('submitted', 'approved'));

create policy "Gestor ve todas as avaliacoes"
  on evaluations for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente cria avaliacao"
  on evaluations for insert with check (
    agente_id = auth.uid()
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

create policy "Agente edita draft/rejected"
  on evaluations for update using (
    agente_id = auth.uid()
    and status in ('draft', 'rejected')
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

create policy "Gestor actualiza qualquer avaliacao"
  on evaluations for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- 7. Drop old criterion_scores policies
drop policy if exists "Agente le scores da sua avaliacao" on criterion_scores;
drop policy if exists "Agente lê scores da sua avaliação" on criterion_scores;
drop policy if exists "Gestor le todos os scores" on criterion_scores;
drop policy if exists "Gestor lê todos os scores" on criterion_scores;
drop policy if exists "Todos leem scores de avaliacoes aprovadas" on criterion_scores;
drop policy if exists "Todos leem scores de avaliações aprovadas" on criterion_scores;
drop policy if exists "Agente escreve scores em avaliacao draft/rejected" on criterion_scores;
drop policy if exists "Agente escreve scores em avaliação draft/rejected" on criterion_scores;
drop policy if exists "Gestor escreve qualquer score" on criterion_scores;

-- 8. Create new criterion_scores policies
create policy "Agente le scores da sua avaliacao"
  on criterion_scores for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Todos leem scores submitted/approved"
  on criterion_scores for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved'))
  );

create policy "Gestor le todos os scores"
  on criterion_scores for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve scores draft/rejected"
  on criterion_scores for all using (
    exists (
      select 1 from evaluations e
      join evaluation_cycles c on c.id = e.cycle_id
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
        and c.status = 'open'
    )
  );

create policy "Gestor escreve qualquer score"
  on criterion_scores for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- 9. Drop old evidences policies
drop policy if exists "Agente le evidencias da sua avaliacao" on evidences;
drop policy if exists "Agente lê evidências da sua avaliação" on evidences;
drop policy if exists "Gestor le todas as evidencias" on evidences;
drop policy if exists "Gestor lê todas as evidências" on evidences;
drop policy if exists "Todos leem evidencias de avaliacoes aprovadas" on evidences;
drop policy if exists "Todos leem evidências de avaliações aprovadas" on evidences;
drop policy if exists "Agente escreve evidencias em avaliacao draft/rejected" on evidences;
drop policy if exists "Agente escreve evidências em avaliação draft/rejected" on evidences;
drop policy if exists "Gestor escreve qualquer evidencia" on evidences;
drop policy if exists "Gestor escreve qualquer evidência" on evidences;

-- 10. Create new evidences policies
create policy "Agente le evidencias da sua avaliacao"
  on evidences for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Todos leem evidencias submitted/approved"
  on evidences for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved'))
  );

create policy "Gestor le todas as evidencias"
  on evidences for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve evidencias draft/rejected"
  on evidences for all using (
    exists (
      select 1 from evaluations e
      join evaluation_cycles c on c.id = e.cycle_id
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
        and c.status = 'open'
    )
  );

create policy "Gestor escreve qualquer evidencia"
  on evidences for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql supabase/migrations/001_evaluation_cycles.sql
git commit -m "feat(schema): add evaluation_cycles table and new RLS policies"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add EvaluationCycle interface and update Evaluation and AppState**

Add `EvaluationCycle` after `UserProfile`:

```typescript
export type CycleStatus = 'open' | 'closed';

export interface EvaluationCycle {
  id: string;
  name: string;
  status: CycleStatus;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
}
```

Add `cycleId` to `Evaluation` interface (after `bankId`):

```typescript
  cycleId: string;
```

Add to `AppState`:

```typescript
  cycles: EvaluationCycle[];
  activeCycleId: string | null;
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: type errors in db.ts and store.ts (they don't populate the new fields yet). That's fine — we fix them in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add EvaluationCycle, cycleId, and cycle state"
```

---

### Task 3: Database layer (db.ts)

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add DbEvaluationCycle type and mapper**

After the existing `DbEvidence` interface, add:

```typescript
interface DbEvaluationCycle {
  id: string;
  name: string;
  status: 'open' | 'closed';
  created_by: string;
  created_at: string;
  closed_at: string | null;
}
```

Add import of `EvaluationCycle` and `CycleStatus` to the imports from `'./types'`.

- [ ] **Step 2: Add cycle CRUD functions**

After the `fetchDimensionWeights` / `saveDimensionWeights` block, add:

```typescript
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
```

- [ ] **Step 3: Update mapEvaluation to include cycleId**

In the `mapEvaluation` function, add to the returned object:

```typescript
    cycleId: row.cycle_id,
```

Update `DbEvaluation` interface to include:

```typescript
  cycle_id: string;
```

- [ ] **Step 4: Update evaluation query functions to filter by cycleId**

Replace `fetchMyEvaluations`:

```typescript
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
```

Replace `fetchApprovedEvaluations` with a broader `fetchVisibleEvaluations`:

```typescript
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
```

Replace `fetchAllEvaluations`:

```typescript
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
```

Remove the old `fetchApprovedEvaluations` function.

- [ ] **Step 5: Update createEvaluation to include cycleId**

```typescript
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): cycle CRUD and cycle-filtered evaluation queries"
```

---

### Task 4: Store (store.ts)

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Update imports**

Add `EvaluationCycle` to the type import from `'./types'`.

Replace `fetchApprovedEvaluations` with `fetchVisibleEvaluations` in the import from `'./db'`.

Add `fetchCycles, createCycleDb, closeCycleDb` to the import from `'./db'`.

- [ ] **Step 2: Update EMPTY_STATE**

```typescript
const EMPTY_STATE: AppState = {
  banks: {},
  bankList: [],
  dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS },
  evaluations: [],
  cycles: [],
  activeCycleId: null,
};
```

- [ ] **Step 3: Simplify buildBanksMap**

The new RLS policies mean that Supabase already filters evaluations by visibility. We no longer need the gestor/agente fallback logic. Replace `buildBanksMap`:

```typescript
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
```

- [ ] **Step 4: Rewrite loadFromSupabase**

```typescript
export async function loadFromSupabase(isGestor: boolean): Promise<void> {
  try {
    const [bankList, dimensionWeights, cycles] = await Promise.all([
      fetchBanks(),
      fetchDimensionWeights(),
      fetchCycles(),
    ]);

    const activeCycle = cycles.find(c => c.status === 'open') ?? cycles[0] ?? null;
    const activeCycleId = activeCycle?.id ?? null;

    const evaluations = activeCycleId
      ? (isGestor
          ? await fetchAllEvaluations(activeCycleId)
          : await fetchVisibleEvaluations(activeCycleId))
      : [];

    const banks = buildBanksMap(bankList, evaluations);

    _loading = false;
    commit({
      bankList,
      dimensionWeights,
      banks,
      evaluations,
      cycles,
      activeCycleId,
    });
  } catch (err) {
    console.error('[store] Erro ao carregar do Supabase:', err);
    _loading = false;
    notify();
  }
}
```

- [ ] **Step 5: Update startEvaluation to pass cycleId**

```typescript
  const startEvaluation = useCallback(async (bankId: string): Promise<Evaluation | null> => {
    const cycleId = _state.activeCycleId;
    if (!cycleId) return null;
    const existing = _state.evaluations.find(
      e => e.bankId === bankId && e.cycleId === cycleId && ['draft', 'rejected'].includes(e.status)
    );
    if (existing) return existing;
    const ev = await createEvaluation(bankId, cycleId);
    if (!ev) return null;
    commit({
      evaluations: [..._state.evaluations, ev],
      banks: { ..._state.banks, [bankId]: evaluationToBankData(ev) },
    });
    return ev;
  }, []);
```

- [ ] **Step 6: Add cycle management actions**

Add inside `useStore()`, before the return statement:

```typescript
  const createCycle = useCallback(async (name: string) => {
    const cycle = await createCycleDb(name);
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
    const evaluations = isGestor
      ? await fetchAllEvaluations(cycleId)
      : await fetchVisibleEvaluations(cycleId);
    const banks = buildBanksMap(_state.bankList, evaluations);
    commit({ activeCycleId: cycleId, evaluations, banks });
  }, []);
```

Update the return object to include `createCycle`, `closeCycle`, `selectCycle`.

- [ ] **Step 7: Update import in store.ts**

Make sure `fetchVisibleEvaluations` is imported (replacing `fetchApprovedEvaluations`) and `fetchMyEvaluations` is kept (but now unused — remove it from the import).

- [ ] **Step 8: Build check**

```bash
npx tsc --noEmit
```

Expected: possible errors in pages that use old store API. Fix any remaining type issues.

- [ ] **Step 9: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): load cycles, filter evaluations by cycle, cycle management"
```

---

### Task 5: Cycle management UI (Configuracoes.tsx)

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

- [ ] **Step 1: Add cycle management section**

Import new icons and hooks:

```typescript
import { Plus, Pencil, Trash2, Check, X, Save, RotateCcw, AlertCircle, Calendar, Lock } from 'lucide-react';
```

Add `useAuth` import:

```typescript
import { useAuth } from '../contexts/AuthContext';
```

Destructure `createCycle` and `closeCycle` from `useStore()`:

```typescript
const { state, addBank, updateBankRecord, removeBank, updateDimensionWeights, createCycle, closeCycle } = useStore();
```

Add state for cycle creation:

```typescript
const [newCycleName, setNewCycleName] = useState('');
const [creatingCycle, setCreatingCycle] = useState(false);
const [closingCycle, setClosingCycle] = useState<string | null>(null);
```

Add handlers:

```typescript
async function handleCreateCycle() {
  const name = newCycleName.trim();
  if (!name) return;
  const hasOpen = state.cycles.some(c => c.status === 'open');
  if (hasOpen) return;
  setCreatingCycle(true);
  await createCycle(name);
  setCreatingCycle(false);
  setNewCycleName('');
}

async function handleCloseCycle(cycleId: string) {
  if (closingCycle === cycleId) {
    await closeCycle(cycleId);
    setClosingCycle(null);
  } else {
    setClosingCycle(cycleId);
  }
}
```

Add section JSX before the Banks section (before `{/* ── Banks section */}`):

```tsx
{/* ── Cycles section ──────────────────────────────────────────────── */}
<section className="mb-8">
  <h2 className="text-sm font-bold text-brand-black mb-4">Ciclos de Avaliacao</h2>
  <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
    {/* Create cycle form — only if no open cycle */}
    {!state.cycles.some(c => c.status === 'open') && (
      <div className="p-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-brand-dark mb-1.5">Novo Ciclo</label>
            <input
              type="text"
              value={newCycleName}
              onChange={e => setNewCycleName(e.target.value)}
              placeholder="ex: Benchmark Q3 2026"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
              onKeyDown={e => e.key === 'Enter' && handleCreateCycle()}
            />
          </div>
          <button
            onClick={handleCreateCycle}
            disabled={!newCycleName.trim() || creatingCycle}
            className="flex items-center gap-2 text-sm bg-brand-blue text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Criar Ciclo
          </button>
        </div>
      </div>
    )}

    {/* Cycle list */}
    <div className="divide-y divide-gray-50">
      {state.cycles.map(cycle => (
        <div key={cycle.id} className="px-5 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            cycle.status === 'open' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {cycle.status === 'open' ? <Calendar size={14} className="text-green-600" /> : <Lock size={14} className="text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-brand-black">{cycle.name}</div>
            <div className="text-xs text-brand-gray">
              {cycle.status === 'open' ? 'Aberto' : `Fechado em ${new Date(cycle.closedAt!).toLocaleDateString('pt-AO')}`}
              {' — '}Criado em {new Date(cycle.createdAt).toLocaleDateString('pt-AO')}
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            cycle.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {cycle.status === 'open' ? 'Aberto' : 'Fechado'}
          </span>
          {cycle.status === 'open' && (
            <button
              onClick={() => handleCloseCycle(cycle.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                closingCycle === cycle.id
                  ? 'bg-red-500 text-white'
                  : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              }`}
            >
              {closingCycle === cycle.id ? 'Confirmar fecho' : 'Fechar ciclo'}
            </button>
          )}
        </div>
      ))}
    </div>

    {state.cycles.length === 0 && (
      <div className="px-5 py-8 text-center text-sm text-brand-gray">
        Nenhum ciclo criado. Crie o primeiro ciclo para iniciar as avaliacoes.
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(config): cycle management UI (create, close, list)"
```

---

### Task 6: Avaliacao.tsx — Cycle guard and bank availability

**Files:**
- Modify: `src/pages/Avaliacao.tsx`

- [ ] **Step 1: Add cycle guard**

After the existing state destructuring, add:

```typescript
const activeCycleId = state.activeCycleId;
const activeCycle = state.cycles.find(c => c.id === activeCycleId);
```

Early return if no active open cycle (add before the `bData` line):

```tsx
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
```

- [ ] **Step 2: Show bank claim status in the bank dropdown**

In the bank selector dropdown, show which banks are already claimed by another agent. Find the section where `bankList` is rendered as options/select. For each bank, check if an evaluation exists for that bank in the current cycle by another agent:

```typescript
function bankStatus(bankId: string): 'available' | 'mine' | 'taken' | 'submitted' | 'approved' {
  const ev = state.evaluations.find(e => e.bankId === bankId && e.cycleId === activeCycleId);
  if (!ev) return 'available';
  if (ev.status === 'approved') return 'approved';
  if (ev.status === 'submitted') return 'submitted';
  if (ev.agenteId === profile?.id) return 'mine';
  return 'taken';
}
```

Disable the bank in the selector if status is `'taken'` (another agent's draft). Show visual indicator.

- [ ] **Step 3: Prevent starting evaluation on taken bank**

In `ensureEvaluation`, add at the top:

```typescript
if (!activeCycleId) return null;
const status = bankStatus(selectedBank);
if (status === 'taken' || status === 'submitted' || status === 'approved') return null;
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Avaliacao.tsx
git commit -m "feat(avaliacao): cycle guard and bank claim status"
```

---

### Task 7: Dashboard.tsx and Ranking.tsx — Cycle selector

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Ranking.tsx`

- [ ] **Step 1: Add cycle selector to Dashboard**

Import `useStore` (replacing `useSnapshot`) and `useAuth`:

```typescript
import { useStore } from '../lib/store';
import { useAuth } from '../contexts/AuthContext';
```

Destructure `selectCycle` from store. Add cycle selector as a `<select>` in the PageHeader actions:

```tsx
<select
  value={state.activeCycleId ?? ''}
  onChange={async (e) => {
    await selectCycle(e.target.value, profile?.role === 'gestor');
  }}
  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
>
  {state.cycles.map(c => (
    <option key={c.id} value={c.id}>
      {c.name} {c.status === 'open' ? '(activo)' : ''}
    </option>
  ))}
</select>
```

- [ ] **Step 2: Add same cycle selector to Ranking**

Same pattern: import `useStore` and add cycle dropdown in PageHeader actions.

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Ranking.tsx
git commit -m "feat(dashboard,ranking): cycle selector dropdown"
```

---

### Task 8: Banks.tsx — Status badge per bank

**Files:**
- Modify: `src/pages/Banks.tsx`

- [ ] **Step 1: Add cycle-aware status badge**

The `Banks` page already shows status from `state.banks[b.id]?.status`. Since `state.banks` is now built from cycle-filtered evaluations, the existing status badges should work correctly. Verify that the page reads from `state.banks` which is cycle-scoped.

If the bank has no evaluation in the current cycle, `state.banks[b.id]` will be a default empty `BankData` with `status: 'draft'`. The existing `STATUS_STYLES` already handles this with "Rascunho".

Add a check: if `state.activeCycleId` is null, show a message. Add a small indicator showing "Nao iniciado" vs "Rascunho" (a bank with no evaluation yet vs one with a draft):

```typescript
const hasEvaluation = state.evaluations.some(e => e.bankId === b.id);
```

Use this to show "Nao iniciado" label for banks without any evaluation in the cycle.

- [ ] **Step 2: Commit**

```bash
git add src/pages/Banks.tsx
git commit -m "feat(banks): cycle-aware status badges"
```

---

### Task 9: Revisao.tsx and BankDetail.tsx — Cycle filtering

**Files:**
- Modify: `src/pages/Revisao.tsx`
- Modify: `src/pages/BankDetail.tsx`

- [ ] **Step 1: Revisao — filter by active cycle**

The Revisao page already reads from `state.evaluations`. Since `loadFromSupabase` now filters by cycle, the list is already cycle-scoped. Verify no changes needed beyond confirming the data flow.

If the gestor switches cycles, the evaluations array will update via `selectCycle`. No code change needed if the page reads from `state.evaluations`.

- [ ] **Step 2: BankDetail — read from cycle-scoped banks map**

BankDetail reads from `state.banks[id]` which is now cycle-scoped. Verify it works.

The evaluation lookup `state.evaluations.find(e => e.bankId === id)` should still work because `state.evaluations` is cycle-filtered.

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit (if any changes were needed)**

```bash
git add src/pages/Revisao.tsx src/pages/BankDetail.tsx
git commit -m "fix(revisao,bankdetail): verify cycle-scoped data flow"
```

---

### Task 10: Full build and verification

**Files:** None (verification only)

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 2: Start dev server and verify**

Start the dev server and verify:
1. Login page works
2. No cycle exists initially (before migration) — app handles gracefully
3. After running migration: "Ciclo Inicial" appears
4. Configuracoes page shows the cycle
5. Dashboard shows cycle selector
6. Avaliacao page shows banks with correct availability
7. Revisao page shows evaluations from the active cycle

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from cycle integration testing"
```

---

### Task 11: Push and user runs migration

**Files:** None

- [ ] **Step 1: Push all commits**

```bash
git push origin master
```

- [ ] **Step 2: User runs migration SQL**

User must run `supabase/migrations/001_evaluation_cycles.sql` in the Supabase SQL Editor. This:
1. Creates the `evaluation_cycles` table
2. Adds `cycle_id` to evaluations
3. Creates "Ciclo Inicial" and assigns all existing evaluations
4. Replaces all RLS policies

- [ ] **Step 3: Verify in production**

After Vercel deploys and migration runs:
1. Login as gestor — see "Ciclo Inicial" in Configuracoes
2. Login as agente — see banks with correct availability
3. Dashboard and Ranking show cycle selector
4. Avaliacao respects cycle boundaries
