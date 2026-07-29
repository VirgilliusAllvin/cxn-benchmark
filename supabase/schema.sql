-- ============================================================
-- CXN Benchmark — Schema Supabase
-- Correr no SQL Editor do projecto Supabase
-- ============================================================

-- ── Extensões ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Perfis de utilizador ─────────────────────────────────────
create table if not exists profiles (
  id   uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('agente', 'gestor')),
  created_at timestamptz default now()
);
alter table profiles enable row level security;

create policy "Utilizador lê o próprio perfil"
  on profiles for select using (auth.uid() = id);

create policy "Gestor lê todos os perfis"
  on profiles for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente le perfis de quem pediu acesso"
  on profiles for select using (
    exists (
      select 1 from access_requests ar
      join evaluations e on e.id = ar.evaluation_id
      where ar.requester_id = profiles.id
        and e.agente_id = auth.uid()
    )
  );

create policy "Utilizador actualiza o próprio perfil"
  on profiles for update using (auth.uid() = id);

-- ── Bancos ───────────────────────────────────────────────────
create table if not exists banks (
  id         text primary key,
  name       text not null,
  short_name text not null,
  active     boolean default true,
  created_at timestamptz default now()
);
alter table banks enable row level security;

create policy "Qualquer utilizador autenticado lê bancos"
  on banks for select using (auth.role() = 'authenticated');

create policy "Gestor gere bancos"
  on banks for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- ── Configuração global ───────────────────────────────────────
create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table app_config enable row level security;

create policy "Qualquer utilizador autenticado lê config"
  on app_config for select using (auth.role() = 'authenticated');

create policy "Gestor actualiza config"
  on app_config for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

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

-- ── Avaliações ────────────────────────────────────────────────
create table if not exists evaluations (
  id                 uuid primary key default gen_random_uuid(),
  bank_id            text references banks(id) on delete cascade,
  cycle_id           uuid references evaluation_cycles(id),
  agente_id          uuid references profiles(id),
  status             text not null default 'draft'
                       check (status in ('draft', 'submitted', 'approved', 'rejected')),
  notes              text default '',
  rejection_comment  text default '',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  gestor_id          uuid references profiles(id),
  constraint uq_evaluation_per_bank_per_cycle unique (cycle_id, bank_id)
);
alter table evaluations enable row level security;

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
  )
  with check (
    agente_id = auth.uid()
  );

create policy "Agente ve avaliacoes draft de outros no ciclo"
  on evaluations for select using (
    status = 'draft'
    and agente_id != auth.uid()
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

create policy "Gestor actualiza qualquer avaliacao"
  on evaluations for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- ── Scores por critério ───────────────────────────────────────
create table if not exists criterion_scores (
  id             uuid primary key default gen_random_uuid(),
  evaluation_id  uuid references evaluations(id) on delete cascade,
  criterion_id   text not null,
  score          integer default 0,
  observations   text default '',
  device         text default '',
  answered       boolean not null default false,
  updated_at     timestamptz default now(),
  unique(evaluation_id, criterion_id)
);
alter table criterion_scores enable row level security;

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

-- ── Evidências ────────────────────────────────────────────────
create table if not exists evidences (
  id             uuid primary key default gen_random_uuid(),
  evaluation_id  uuid references evaluations(id) on delete cascade,
  criterion_id   text not null,
  type           text not null check (type in ('link', 'note', 'image')),
  content        text not null,
  description    text default '',
  collected_at   timestamptz default now(),
  tags           text[] default '{}'
);
alter table evidences enable row level security;

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

-- ── Pedidos de acesso a avaliações ────────────────────────────
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

create policy "Agente le os seus pedidos"
  on access_requests for select using (requester_id = auth.uid());

create policy "Gestor le todos os pedidos"
  on access_requests for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Dono ve pedidos da sua avaliacao"
  on access_requests for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

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

create policy "Gestor gere pedidos"
  on access_requests for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente cancela o seu pedido pendente"
  on access_requests for delete using (
    requester_id = auth.uid()
    and status = 'pending'
  );

-- ── Função para auto-criar perfil no signup ───────────────────
-- (opcional — pode-se criar perfis manualmente no início)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'agente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Dados iniciais ────────────────────────────────────────────

-- Bancos angolanos (17)
insert into banks (id, name, short_name) values
  ('bai',       'Banco Angolano de Investimentos',  'BAI'),
  ('bfa',       'Banco de Fomento Angola',          'BFA'),
  ('bic',       'Banco BIC Angola',                 'BIC'),
  ('economico', 'Banco Económico',                  'Económico'),
  ('atlantico', 'Banco Millennium Atlântico',       'Atlântico'),
  ('sol',       'Banco Sol',                        'SOL'),
  ('keve',      'Banco Keve',                       'Keve'),
  ('bpc',       'Banco de Poupança e Crédito',      'BPC'),
  ('bca',       'Banco Comercial Angolano',         'BCA'),
  ('bci',       'Banco de Comércio e Indústria',    'BCI'),
  ('standard',  'Standard Bank de Angola',          'Standard'),
  ('yetu',      'Banco Yetu',                       'Yetu'),
  ('valor',     'Banco Valor',                      'Valor'),
  ('prestigio', 'Banco Prestígio',                  'Prestígio'),
  ('bni',       'Banco de Negócios Internacional',  'BNI'),
  ('caixa',     'Banco Caixa Geral Angola',         'Caixa'),
  ('vtb',       'VTB África',                       'VTB')
on conflict (id) do nothing;

-- Pesos das dimensões por omissão
insert into app_config (key, value) values
  ('dimension_weights', '{"D1":10,"D2":10,"D3":20,"D4":20,"D5":5,"D6":10,"D7":10,"D8":15}')
on conflict (key) do nothing;
