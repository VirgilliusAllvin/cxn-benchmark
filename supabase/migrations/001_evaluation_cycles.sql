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
drop policy if exists "Agente vê as suas avaliações" on evaluations;
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
