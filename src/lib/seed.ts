/**
 * Seed data — realistic mock evaluations for the first load.
 * Uses criterionScores keyed by the new CRITERIA IDs (C1_1 … C8_4).
 */
import type { BankData, CriterionScore } from './types';
import { CRITERIA } from './data';

function mkScore(score: number, obs = '', device = 'Android'): CriterionScore {
  return { score, observations: obs, device, evidences: [] };
}

/** Build a full criterionScores map from a partial map — missing keys get score 0 */
function buildScores(partial: Record<string, CriterionScore>): Record<string, CriterionScore> {
  const base: Record<string, CriterionScore> = {};
  CRITERIA.forEach(c => {
    base[c.id] = partial[c.id] ?? { score: 0, observations: '', device: '', evidences: [] };
  });
  return base;
}

// ── BAI — highest performer ───────────────────────────────────────────────────

const baiScores = buildScores({
  // D1
  C1_1: mkScore(5, 'Abertura 100% digital disponível na app', 'Android'),
  C1_2: mkScore(5, 'Upload de documentos simples e rápido'),
  C1_3: mkScore(4, 'Activação em menos de 24h'),
  C1_4: mkScore(5, 'Tutorial interactivo no primeiro acesso'),
  // D2
  C2_1: mkScore(4, 'Menus bem organizados, poucos níveis de navegação'),
  C2_2: mkScore(5, 'Interface coerente ao longo de toda a app'),
  C2_3: mkScore(5, 'Transferência acessível em 2 toques'),
  C2_4: mkScore(5, 'Modo escuro disponível e bem implementado'),
  // D3
  C3_1: mkScore(5, 'Extracto detalhado com filtros avançados'),
  C3_2: mkScore(5, 'IBAN facilmente acessível e partilhável'),
  C3_3: mkScore(5, 'Bloqueio de cartão disponível em 1 toque'),
  C3_4: mkScore(5, 'Exportação de extracto em PDF'),
  // D4
  C4_1: mkScore(5, 'Transferência intrabancária simples e clara'),
  C4_2: mkScore(4, 'Taxas visíveis, processo claro'),
  C4_3: mkScore(5, 'Pagamento de água e luz disponível'),
  C4_4: mkScore(5, 'Recarga de telemóvel para todas as operadoras'),
  // D5
  C5_1: mkScore(5, 'Mapa de ATM integrado na app'),
  C5_2: mkScore(4, 'Saldo actualiza em menos de 5 minutos'),
  C5_3: mkScore(4, 'Notificação push após depósito'),
  // D6
  C6_1: mkScore(5, 'Chat in-app com resposta rápida'),
  C6_2: mkScore(4, 'Tempo de resposta médio: 10 min'),
  C6_3: mkScore(4, 'FAQ bem estruturada e actualizada'),
  // D7
  C7_1: mkScore(5, 'Biometria disponível e fiável'),
  C7_2: mkScore(5, 'Notificações configuráveis por tipo de operação'),
  C7_3: mkScore(4, 'Limites visíveis mas não ajustáveis pelo utilizador'),
  C7_4: mkScore(5, '2FA para transferências acima de 50.000 AOA'),
  // D8
  C8_1: mkScore(5, 'App carrega em menos de 2 segundos'),
  C8_2: mkScore(5, 'Nenhum crash durante o período de avaliação'),
  C8_3: mkScore(4, 'Uma breve indisponibilidade detectada às 2h'),
  C8_4: mkScore(5, 'Mensagens de erro claras e accionáveis'),
});

// ── Standard Bank ─────────────────────────────────────────────────────────────

const standardScores = buildScores({
  C1_1: mkScore(5), C1_2: mkScore(5), C1_3: mkScore(4), C1_4: mkScore(4),
  C2_1: mkScore(4), C2_2: mkScore(4), C2_3: mkScore(5), C2_4: mkScore(3),
  C3_1: mkScore(5), C3_2: mkScore(5), C3_3: mkScore(4), C3_4: mkScore(5),
  C4_1: mkScore(5), C4_2: mkScore(4), C4_3: mkScore(5), C4_4: mkScore(4),
  C5_1: mkScore(4), C5_2: mkScore(4), C5_3: mkScore(4),
  C6_1: mkScore(4), C6_2: mkScore(4), C6_3: mkScore(4),
  C7_1: mkScore(5), C7_2: mkScore(4), C7_3: mkScore(4), C7_4: mkScore(5),
  C8_1: mkScore(4), C8_2: mkScore(5), C8_3: mkScore(4), C8_4: mkScore(4),
});

// ── Atlântico ─────────────────────────────────────────────────────────────────

const atlanticoScores = buildScores({
  C1_1: mkScore(3), C1_2: mkScore(3), C1_3: mkScore(3), C1_4: mkScore(3),
  C2_1: mkScore(4), C2_2: mkScore(4), C2_3: mkScore(3), C2_4: mkScore(0),
  C3_1: mkScore(4), C3_2: mkScore(4), C3_3: mkScore(3), C3_4: mkScore(3),
  C4_1: mkScore(4), C4_2: mkScore(3), C4_3: mkScore(3), C4_4: mkScore(4),
  C5_1: mkScore(3), C5_2: mkScore(3), C5_3: mkScore(3),
  C6_1: mkScore(0), C6_2: mkScore(3), C6_3: mkScore(3),
  C7_1: mkScore(4), C7_2: mkScore(3), C7_3: mkScore(3), C7_4: mkScore(3),
  C8_1: mkScore(3), C8_2: mkScore(4), C8_3: mkScore(4), C8_4: mkScore(3),
});

// ── BIC ───────────────────────────────────────────────────────────────────────

const bicScores = buildScores({
  C1_1: mkScore(3), C1_2: mkScore(3), C1_3: mkScore(3), C1_4: mkScore(0),
  C2_1: mkScore(3), C2_2: mkScore(3), C2_3: mkScore(3), C2_4: mkScore(0),
  C3_1: mkScore(4), C3_2: mkScore(3), C3_3: mkScore(3), C3_4: mkScore(3),
  C4_1: mkScore(3), C4_2: mkScore(3), C4_3: mkScore(3), C4_4: mkScore(3),
  C5_1: mkScore(3), C5_2: mkScore(3), C5_3: mkScore(0),
  C6_1: mkScore(0), C6_2: mkScore(3), C6_3: mkScore(3),
  C7_1: mkScore(3), C7_2: mkScore(3), C7_3: mkScore(3), C7_4: mkScore(3),
  C8_1: mkScore(3), C8_2: mkScore(3), C8_3: mkScore(3), C8_4: mkScore(3),
});

// ── BFA ───────────────────────────────────────────────────────────────────────

const bfaScores = buildScores({
  C1_1: mkScore(0), C1_2: mkScore(0), C1_3: mkScore(2), C1_4: mkScore(0),
  C2_1: mkScore(3), C2_2: mkScore(3), C2_3: mkScore(2), C2_4: mkScore(0),
  C3_1: mkScore(3), C3_2: mkScore(3), C3_3: mkScore(2), C3_4: mkScore(2),
  C4_1: mkScore(3), C4_2: mkScore(2), C4_3: mkScore(2), C4_4: mkScore(2),
  C5_1: mkScore(2), C5_2: mkScore(2), C5_3: mkScore(0),
  C6_1: mkScore(0), C6_2: mkScore(2), C6_3: mkScore(2),
  C7_1: mkScore(2), C7_2: mkScore(2), C7_3: mkScore(2), C7_4: mkScore(0),
  C8_1: mkScore(2), C8_2: mkScore(3), C8_3: mkScore(3), C8_4: mkScore(2),
});

// ── BPC — partial ─────────────────────────────────────────────────────────────

const bpcScores = buildScores({
  C1_3: mkScore(1), C2_1: mkScore(2), C2_2: mkScore(2),
  C3_1: mkScore(2), C3_2: mkScore(2),
  C4_1: mkScore(2), C4_2: mkScore(1),
  C5_2: mkScore(1),
  C6_2: mkScore(1), C6_3: mkScore(1),
  C7_2: mkScore(1), C7_3: mkScore(1),
  C8_1: mkScore(1), C8_2: mkScore(2), C8_3: mkScore(2), C8_4: mkScore(1),
});

// ── SOL — partial ─────────────────────────────────────────────────────────────

const solScores = buildScores({
  C1_3: mkScore(2),
  C2_1: mkScore(2), C2_2: mkScore(2), C2_3: mkScore(2),
  C3_1: mkScore(2), C3_2: mkScore(2),
  C4_1: mkScore(2), C4_2: mkScore(2), C4_3: mkScore(2), C4_4: mkScore(2),
  C8_1: mkScore(2), C8_2: mkScore(2), C8_3: mkScore(2),
});

// ── Económico — partial ───────────────────────────────────────────────────────

const economicoScores = buildScores({
  C2_1: mkScore(2), C2_2: mkScore(2),
  C3_1: mkScore(2), C3_2: mkScore(2),
  C4_1: mkScore(2), C4_2: mkScore(1),
  C8_1: mkScore(1), C8_2: mkScore(2), C8_3: mkScore(2),
});

// ─────────────────────────────────────────────────────────────────────────────

export const SEED_DATA: Record<string, BankData> = {
  bai: {
    id: 'bai',
    status: 'approved',
    notes: 'Melhor experiência digital do mercado angolano. App madura e bem mantida.',
    updatedAt: '2025-03-10T14:32:00Z',
    criterionScores: baiScores,
  },
  standard: {
    id: 'standard',
    status: 'approved',
    notes: 'Experiência próxima do BAI. Pontos fracos no modo escuro e personalização.',
    updatedAt: '2025-03-10T15:10:00Z',
    criterionScores: standardScores,
  },
  atlantico: {
    id: 'atlantico',
    status: 'approved',
    notes: 'Boa usabilidade, mas faltam funcionalidades modernas como chat e modo escuro.',
    updatedAt: '2025-03-09T11:00:00Z',
    criterionScores: atlanticoScores,
  },
  bic: {
    id: 'bic',
    status: 'approved',
    notes: 'App funcional mas conservadora. Espaço para melhoria em suporte e onboarding.',
    updatedAt: '2025-03-09T13:30:00Z',
    criterionScores: bicScores,
  },
  bfa: {
    id: 'bfa',
    status: 'approved',
    notes: 'Experiência abaixo da média. Onboarding digital inexistente.',
    updatedAt: '2025-03-08T16:00:00Z',
    criterionScores: bfaScores,
  },
  bpc: {
    id: 'bpc',
    status: 'draft',
    notes: 'Avaliação parcial. App com capacidades muito limitadas.',
    updatedAt: '2025-03-11T09:00:00Z',
    criterionScores: bpcScores,
  },
  sol: {
    id: 'sol',
    status: 'draft',
    notes: 'Avaliação em curso. Funcionalidades básicas presentes.',
    updatedAt: '2025-03-11T10:00:00Z',
    criterionScores: solScores,
  },
  economico: {
    id: 'economico',
    status: 'draft',
    notes: 'Avaliação incompleta.',
    updatedAt: '2025-03-11T11:00:00Z',
    criterionScores: economicoScores,
  },
};
