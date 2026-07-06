# Ciclo de Avaliacao — Design Spec

**Data:** 2026-07-06
**Estado:** Aprovado pelo utilizador, pendente de implementacao

## Problema

O sistema actual tem 7 gaps criticos no ciclo de avaliacao:

1. **Sem conceito de ciclo** — avaliacoes sao criadas ad-hoc, sem controlo temporal.
2. **Multiplas avaliacoes por banco** — dois agentes podem avaliar o mesmo banco em paralelo.
3. **Visibilidade inconsistente** — cada utilizador ve dados diferentes (o mapa `banks` e construido de forma diferente para agente vs gestor).
4. **Sem controlo de quem avalia** — qualquer agente inicia avaliacao de qualquer banco.
5. **Revisao mostra dados errados** — "Ver detalhe" aponta para BankDetail que le do mapa `banks`, nao da avaliacao especifica.
6. **Sem sincronizacao entre sessoes** — aprovacao feita num browser nao aparece noutro ate recarregar.
7. **RLS policies de partilha nao aplicadas** — estao no schema.sql mas nunca foram executadas.

## Solucao: Ciclo explicito com tabela `evaluation_cycles`

### Modelo de Dados

#### Nova tabela `evaluation_cycles`

```sql
create table evaluation_cycles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     text not null default 'open'
               check (status in ('open', 'closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  closed_at  timestamptz
);
alter table evaluation_cycles enable row level security;
```

Restricoes:
- Maximo 1 ciclo com status `open` de cada vez (validacao aplicativa no `createCycle`).
- Apenas o gestor cria/fecha ciclos.

#### Alteracao a `evaluations`

```sql
alter table evaluations
  add column cycle_id uuid references evaluation_cycles(id);

alter table evaluations
  add constraint uq_evaluation_per_bank_per_cycle
  unique (cycle_id, bank_id);
```

#### Migracao de dados existentes

Na migracao SQL, criar automaticamente um ciclo "Ciclo Inicial" e atribuir todas as avaliacoes existentes:

```sql
-- 1. Criar ciclo inicial
with new_cycle as (
  insert into evaluation_cycles (name, status, created_at)
  values ('Ciclo Inicial', 'open', now())
  returning id
)
-- 2. Atribuir todas as avaliacoes existentes ao ciclo
update evaluations set cycle_id = (select id from new_cycle);

-- 3. Resolver duplicados (manter a mais recente por banco, apagar o resto)
delete from evaluations
where id not in (
  select distinct on (cycle_id, bank_id) id
  from evaluations
  order by cycle_id, bank_id, updated_at desc
);
```

### RLS Policies

#### evaluation_cycles

```sql
create policy "Todos leem ciclos"
  on evaluation_cycles for select
  using (auth.role() = 'authenticated');

create policy "Gestor gere ciclos"
  on evaluation_cycles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));
```

#### evaluations (substituir policies actuais)

```sql
-- Agente ve as suas avaliacoes (qualquer status)
create policy "Agente ve as suas avaliacoes"
  on evaluations for select
  using (agente_id = auth.uid());

-- Todos veem avaliacoes submetidas e aprovadas
create policy "Todos veem submitted e approved"
  on evaluations for select
  using (status in ('submitted', 'approved'));

-- Gestor ve todas
create policy "Gestor ve todas as avaliacoes"
  on evaluations for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));

-- Agente cria avaliacao (apenas em ciclo open)
create policy "Agente cria avaliacao"
  on evaluations for insert
  with check (
    agente_id = auth.uid()
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

-- Agente edita a sua em draft/rejected (apenas em ciclo open)
create policy "Agente edita draft/rejected"
  on evaluations for update
  using (
    agente_id = auth.uid()
    and status in ('draft', 'rejected')
    and exists (select 1 from evaluation_cycles c where c.id = cycle_id and c.status = 'open')
  );

-- Gestor actualiza qualquer avaliacao
create policy "Gestor actualiza qualquer avaliacao"
  on evaluations for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));
```

#### criterion_scores (substituir policies actuais)

```sql
-- Agente le scores da sua avaliacao
create policy "Agente le scores da sua avaliacao"
  on criterion_scores for select
  using (exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid()));

-- Todos leem scores de avaliacoes submitted/approved
create policy "Todos leem scores submitted/approved"
  on criterion_scores for select
  using (exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved')));

-- Gestor le todos os scores
create policy "Gestor le todos os scores"
  on criterion_scores for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));

-- Agente escreve scores em avaliacao draft/rejected (ciclo open)
create policy "Agente escreve scores draft/rejected"
  on criterion_scores for all
  using (exists (
    select 1 from evaluations e
    join evaluation_cycles c on c.id = e.cycle_id
    where e.id = evaluation_id
      and e.agente_id = auth.uid()
      and e.status in ('draft', 'rejected')
      and c.status = 'open'
  ));

-- Gestor escreve qualquer score
create policy "Gestor escreve qualquer score"
  on criterion_scores for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));
```

#### evidences (mesma logica que criterion_scores)

```sql
-- Agente le evidencias da sua avaliacao
create policy "Agente le evidencias da sua avaliacao"
  on evidences for select
  using (exists (select 1 from evaluations e where e.id = evaluation_id and e.agente_id = auth.uid()));

-- Todos leem evidencias de submitted/approved
create policy "Todos leem evidencias submitted/approved"
  on evidences for select
  using (exists (select 1 from evaluations e where e.id = evaluation_id and e.status in ('submitted', 'approved')));

-- Gestor le todas
create policy "Gestor le todas as evidencias"
  on evidences for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));

-- Agente escreve em draft/rejected (ciclo open)
create policy "Agente escreve evidencias draft/rejected"
  on evidences for all
  using (exists (
    select 1 from evaluations e
    join evaluation_cycles c on c.id = e.cycle_id
    where e.id = evaluation_id
      and e.agente_id = auth.uid()
      and e.status in ('draft', 'rejected')
      and c.status = 'open'
  ));

-- Gestor escreve qualquer evidencia
create policy "Gestor escreve qualquer evidencia"
  on evidences for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gestor'));
```

### Regras de visibilidade (resumo)

| Status da avaliacao | Agente dono | Outros agentes | Gestor |
|---------------------|-------------|----------------|--------|
| draft               | Ve + edita  | Nao ve         | Ve     |
| submitted           | Ve (locked) | **Ve** (locked)| Ve + aprova/rejeita |
| approved            | Ve (locked) | **Ve** (locked)| Ve     |
| rejected            | Ve + edita  | Nao ve         | Ve     |

### Fluxo de Estados

#### Ciclo

```
Gestor cria  -->  OPEN  -->  Gestor fecha  -->  CLOSED (historico, read-only)
```

#### Avaliacao (dentro de um ciclo OPEN)

```
Agente reclama banco  -->  DRAFT  -->  Submeter  -->  SUBMITTED
                             ^                            |
                             |                    Gestor rejeita
                             |                            |
                             +--- Agente corrige <-- REJECTED
                                                          
                                                   Gestor aprova
                                                          |
                                                          v
                                                      APPROVED
```

Quando o ciclo e FECHADO:
- Avaliacoes em draft ficam congeladas (nao editaveis, nao submetiveis).
- Avaliacoes submitted continuam revisaveis pelo gestor.
- Dashboard/Ranking mostram os dados do ciclo.

### Tipos TypeScript

```typescript
export interface EvaluationCycle {
  id: string;
  name: string;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: string;
  closedAt?: string;
}

// Evaluation ganha:
export interface Evaluation {
  // ... campos existentes ...
  cycleId: string;  // NOVO
}

// AppState ganha:
export type AppState = {
  // ... campos existentes ...
  cycles: EvaluationCycle[];     // NOVO — todos os ciclos
  activeCycleId: string | null;  // NOVO — ciclo seleccionado na UI
};
```

### Mudancas por ficheiro

#### db.ts
- `fetchCycles()` — lista todos os ciclos
- `createCycle(name)` — cria ciclo (valida que nao existe outro open)
- `closeCycle(cycleId)` — fecha ciclo
- `createEvaluation(bankId)` -> `createEvaluation(bankId, cycleId)` — inclui cycle_id
- `fetchMyEvaluations()` -> `fetchMyEvaluations(cycleId)` — filtra por ciclo
- `fetchApprovedEvaluations()` -> `fetchEvaluationsByCycle(cycleId)` — retorna todas as visiveis (RLS filtra)
- `fetchAllEvaluations()` -> `fetchAllEvaluations(cycleId)` — filtra por ciclo

#### store.ts
- `loadFromSupabase` carrega ciclos, identifica o activo, filtra avaliacoes
- `state.cycles` e `state.activeCycleId` adicionados
- `buildBanksMap` simplificado — usa avaliacoes ja filtradas por RLS + ciclo
- `startEvaluation(bankId)` valida ciclo activo e verifica se banco ja esta reclamado
- Novo `createCycle`, `closeCycle`, `selectCycle` (para historico)

#### Avaliacao.tsx
- Se nao existe ciclo activo: mensagem "Nenhum ciclo de avaliacao aberto."
- Lista de bancos mostra estado: "Disponivel", "Em avaliacao por [nome]", "Submetido", "Aprovado"
- Bancos reclamados por outro agente ficam desactivados (nao clicaveis)

#### Revisao.tsx
- Filtra avaliacoes do ciclo activo (ja filtrado pelo store)
- "Ver detalhe" continua a apontar para `/banks/:id` (BankDetail mostra dados do ciclo)

#### Dashboard.tsx + Ranking.tsx
- Selector de ciclo no header (dropdown: ciclo activo + ciclos fechados)
- Default = ciclo activo, ou ultimo fechado se nenhum aberto
- Filtra `state.banks` pelo ciclo seleccionado

#### Configuracoes.tsx
- Nova seccao "Ciclos de Avaliacao":
  - Botao "Criar novo ciclo" (input nome)
  - Lista de ciclos com estado (open/closed)
  - Botao "Fechar ciclo" no ciclo activo
  - Nao e possivel apagar ciclos (historico)

#### Banks.tsx
- Card de cada banco mostra badge do estado no ciclo activo:
  - Cinza: "Nao iniciado"
  - Azul: "Em avaliacao"
  - Amber: "Submetido"
  - Verde: "Aprovado"
  - Vermelho: "Rejeitado"

#### BankDetail.tsx
- Le dados da avaliacao do ciclo seleccionado (via `state.banks`)
- Se existem avaliacoes de ciclos anteriores, pode-se mostrar historico (fase futura)

#### types.ts
- `EvaluationCycle` interface
- `Evaluation.cycleId` adicionado
- `AppState.cycles` e `AppState.activeCycleId` adicionados

#### schema.sql
- Actualizado com a nova tabela e policies

### Migracao (SQL a correr no Supabase)

A migracao e executada em 4 passos:

1. Criar tabela `evaluation_cycles` + RLS
2. Adicionar `cycle_id` a `evaluations` (nullable inicialmente)
3. Criar "Ciclo Inicial", atribuir avaliacoes existentes, resolver duplicados
4. Tornar `cycle_id` NOT NULL, aplicar constraint UNIQUE
5. Substituir RLS policies antigas pelas novas

### O que NAO muda

- `calculations.ts` — scoring e agnostico de ciclos
- `ObservationField.tsx` — componente isolado
- `ErrorBoundary.tsx` — safety net independente
- `Login.tsx` / `AuthContext.tsx` — auth intocada
- `data.ts` — criterios e dimensoes intocados
- Sistema de evidencias — intocado
- `index.html` — proteccao anti-translate intocada
