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

-- ── Avaliações ────────────────────────────────────────────────
create table if not exists evaluations (
  id                 uuid primary key default gen_random_uuid(),
  bank_id            text references banks(id) on delete cascade,
  agente_id          uuid references profiles(id),
  status             text not null default 'draft'
                       check (status in ('draft', 'submitted', 'approved', 'rejected')),
  notes              text default '',
  rejection_comment  text default '',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  gestor_id          uuid references profiles(id)
);
alter table evaluations enable row level security;

-- Agente vê as suas próprias avaliações
create policy "Agente vê as suas avaliações"
  on evaluations for select using (agente_id = auth.uid());

-- Gestor vê todas
create policy "Gestor vê todas as avaliações"
  on evaluations for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- Agente cria avaliações para si próprio
create policy "Agente cria avaliação"
  on evaluations for insert with check (agente_id = auth.uid());

-- Agente edita as suas em draft ou rejected
create policy "Agente edita a sua avaliação (draft/rejected)"
  on evaluations for update using (
    agente_id = auth.uid() and status in ('draft', 'rejected')
  );

-- Gestor pode actualizar qualquer avaliação (aprovação/rejeição)
create policy "Gestor actualiza qualquer avaliação"
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

create policy "Agente lê scores da sua avaliação"
  on criterion_scores for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Gestor lê todos os scores"
  on criterion_scores for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve scores em avaliação draft/rejected"
  on criterion_scores for all using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
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

create policy "Agente lê evidências da sua avaliação"
  on evidences for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid())
  );

create policy "Gestor lê todas as evidências"
  on evidences for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

create policy "Agente escreve evidências em avaliação draft/rejected"
  on evidences for all using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_id
        and e.agente_id = auth.uid()
        and e.status in ('draft', 'rejected')
    )
  );

create policy "Gestor escreve qualquer evidência"
  on evidences for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor')
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
