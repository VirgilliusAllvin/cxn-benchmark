-- ============================================================
-- Migration: Access Requests + RLS fix for approve/reject
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create access_requests table
create table if not exists access_requests (
  id              uuid primary key default gen_random_uuid(),
  evaluation_id   uuid not null references evaluations(id) on delete cascade,
  requester_id    uuid not null references profiles(id),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references profiles(id),
  comment         text default '',
  constraint uq_one_pending_per_requester unique (evaluation_id, requester_id)
);
alter table access_requests enable row level security;

-- Agent can read their own requests
create policy "Agente le os seus pedidos"
  on access_requests for select using (requester_id = auth.uid());

-- Gestor can read all requests
create policy "Gestor le todos os pedidos"
  on access_requests for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- Owner of the evaluation can see requests for their evaluation
create policy "Dono ve pedidos da sua avaliacao"
  on access_requests for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

-- Agent can create a request (for evaluation they don't own)
create policy "Agente cria pedido de acesso"
  on access_requests for insert with check (
    requester_id = auth.uid()
    and exists (
      select 1 from evaluations e
      join evaluation_cycles c on c.id = e.cycle_id
      where e.id = evaluation_id
        and e.agente_id != auth.uid()
        and c.status = 'open'
    )
  );

-- Gestor can update any request (approve/reject)
create policy "Gestor gere pedidos"
  on access_requests for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- Agent can delete their own pending request (cancel)
create policy "Agente cancela o seu pedido pendente"
  on access_requests for delete using (
    requester_id = auth.uid()
    and status = 'pending'
  );
