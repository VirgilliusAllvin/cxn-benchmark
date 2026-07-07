-- ============================================================
-- Migration: Fix "Agente edita draft/rejected" RLS self-check bug
-- Run in Supabase SQL Editor
-- ============================================================
--
-- Bug: the policy had no explicit WITH CHECK, so Postgres reused the
-- USING clause (status in ('draft','rejected')) to validate the row
-- AFTER the update too. Submitting an evaluation sets status to
-- 'submitted', which fails that same check — the UPDATE is rejected
-- by RLS and the agent's "Submeter para Revisão" button hangs forever.

drop policy if exists "Agente edita draft/rejected" on evaluations;

create policy "Agente edita draft/rejected"
  on evaluations for update using (
    agente_id = auth.uid()
    and status in ('draft', 'rejected')
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  )
  with check (
    agente_id = auth.uid()
  );
