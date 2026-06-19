// ─── Dimensions ──────────────────────────────────────────────────────────────

export interface Dimension {
  id: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
}

export const DIMENSIONS: Dimension[] = [
  { id: 'D1', name: 'Acesso, Onboarding e Autenticação', shortName: 'Acesso & Auth',   description: 'Login, recuperação de acesso, onboarding digital e logout.',                       color: '#1818db' },
  { id: 'D2', name: 'Usabilidade e Simplicidade (UX)',   shortName: 'Usabilidade / UX', description: 'Fluidez de navegação, consistência visual, clareza e intuitividade.',              color: '#6366f1' },
  { id: 'D3', name: 'Funcionalidades Digitais Essenciais', shortName: 'Funcionalidades', description: 'Consulta de movimentos, IBAN, gestão de cartão.',                                  color: '#0ea5e9' },
  { id: 'D4', name: 'Transferências e Pagamentos',       shortName: 'Transferências',   description: 'Beneficiários, transferências intra/interbancárias, recargas.',                    color: '#1ddbb1' },
  { id: 'D5', name: 'Depósitos e Experiência ATM',       shortName: 'Depósitos / ATM',  description: 'Depósito em ATM, actualização de saldo, comprovativo.',                           color: '#10b981' },
  { id: 'D6', name: 'Atendimento e Suporte',             shortName: 'Suporte',          description: 'Qualidade e rapidez do suporte, canais disponíveis.',                             color: '#f59e0b' },
  { id: 'D7', name: 'Confiança e Segurança Percebida',   shortName: 'Confiança',        description: 'Limites visíveis, notificações, percepção de segurança.',                         color: '#ef4444' },
  { id: 'D8', name: 'Performance e Estabilidade',        shortName: 'Performance',      description: 'Velocidade, estabilidade, disponibilidade e resiliência da app.',                 color: '#8b5cf6' },
];

/** Default weights (percentage, must sum to 100) */
export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  D1: 10,
  D2: 10,
  D3: 20,
  D4: 20,
  D5: 5,
  D6: 10,
  D7: 10,
  D8: 15,
};

// ─── Criteria ─────────────────────────────────────────────────────────────────

export type CriterionType = 'binary' | 'scalar';

export interface Criterion {
  id: string;
  name: string;
  dimensionId: string;
  type: CriterionType;
  question: string;     // evaluator-facing question
  description: string;
}

export const CRITERIA: Criterion[] = [
  // D1 — Acesso, Onboarding e Autenticação
  { id: 'C1_1', name: 'Abertura de conta 100% digital',     dimensionId: 'D1', type: 'binary', question: 'É possível abrir conta completamente online, sem visitar a agência?',          description: 'Verificar se o processo de abertura de conta pode ser feito inteiramente via app ou web.' },
  { id: 'C1_2', name: 'Upload de documentos in-app',        dimensionId: 'D1', type: 'binary', question: 'A app permite fazer upload de documentos de identificação?',                   description: 'Testar se o cliente pode submeter BI, passaporte ou outros documentos pela app.' },
  { id: 'C1_3', name: 'Tempo de activação da conta',        dimensionId: 'D1', type: 'scalar', question: 'Qual a rapidez e simplicidade do processo de activação após registo?',          description: 'Avaliar o tempo estimado e número de passos até a conta estar activa e operacional.' },
  { id: 'C1_4', name: 'Onboarding guiado (tutorial)',       dimensionId: 'D1', type: 'binary', question: 'Existe um tutorial ou assistente de onboarding ao primeiro acesso?',             description: 'Verificar se há um fluxo guiado que apresenta as funcionalidades ao novo utilizador.' },

  // D2 — Usabilidade e Simplicidade (UX)
  { id: 'C2_1', name: 'Clareza da arquitectura de informação', dimensionId: 'D2', type: 'scalar', question: 'Quão clara e intuitiva é a organização dos menus e funcionalidades?',       description: 'Avaliar se o utilizador encontra facilmente o que precisa, sem esforço cognitivo elevado.' },
  { id: 'C2_2', name: 'Consistência visual',                dimensionId: 'D2', type: 'scalar', question: 'A interface mantém consistência de estilo, cores e comportamentos ao longo da app?', description: 'Verificar se botões, tipografia, ícones e padrões de interacção são coerentes.' },
  { id: 'C2_3', name: 'Acesso a funções em ≤3 toques',     dimensionId: 'D2', type: 'binary', question: 'As funções principais estão acessíveis em 3 toques ou menos a partir do ecrã inicial?', description: 'Testar se transferências, saldo e pagamentos estão a no máximo 3 interacções do ecrã principal.' },
  { id: 'C2_4', name: 'Modo escuro disponível',             dimensionId: 'D2', type: 'binary', question: 'A app oferece modo escuro como opção de visualização?',                        description: 'Verificar a disponibilidade do modo escuro nas definições ou automaticamente pelo sistema.' },

  // D3 — Funcionalidades Digitais Essenciais
  { id: 'C3_1', name: 'Consulta de saldo e movimentos',     dimensionId: 'D3', type: 'scalar', question: 'Quão fácil e detalhado é o acesso ao saldo e histórico de movimentos?',        description: 'Avaliar detalhe de transacções, filtros disponíveis e clareza da informação apresentada.' },
  { id: 'C3_2', name: 'Obter e partilhar IBAN/Comprovativo', dimensionId: 'D3', type: 'binary', question: 'É simples localizar o IBAN e gerar/partilhar um comprovativo de conta?',     description: 'Testar a facilidade de aceder ao IBAN, gerar comprovativo em PDF e partilhá-lo.' },
  { id: 'C3_3', name: 'Gestão de cartão in-app',            dimensionId: 'D3', type: 'binary', question: 'É possível bloquear/desbloquear cartão e gerir limites directamente na app?',  description: 'Verificar se operações de cartão (bloqueio, limites, PIN) estão disponíveis sem contactar suporte.' },
  { id: 'C3_4', name: 'Extracto digital exportável',        dimensionId: 'D3', type: 'binary', question: 'A app permite exportar extracto em PDF ou outro formato digital?',              description: 'Testar a funcionalidade de exportação/download de extracto de conta.' },

  // D4 — Transferências e Pagamentos
  { id: 'C4_1', name: 'Transferência intrabancária',        dimensionId: 'D4', type: 'scalar', question: 'Quão simples e claro é o processo de transferência para contas do mesmo banco?', description: 'Medir número de passos, clareza de comissões e feedback ao utilizador.' },
  { id: 'C4_2', name: 'Transferência interbancária',        dimensionId: 'D4', type: 'scalar', question: 'Quão claro e eficiente é o processo de transferência para outros bancos?',      description: 'Avaliar clareza de taxas, prazo de liquidação e confirmação da operação.' },
  { id: 'C4_3', name: 'Pagamento de serviços (água/luz/outros)', dimensionId: 'D4', type: 'binary', question: 'A app permite pagar serviços como água, electricidade ou outros?',      description: 'Verificar se existem templates de pagamento para os principais serviços públicos.' },
  { id: 'C4_4', name: 'Recarga de telemóvel in-app',        dimensionId: 'D4', type: 'binary', question: 'A app permite recarregar telemóvel directamente, para qualquer operadora?',    description: 'Testar a facilidade de seleccionar operadora e valor de recarga.' },

  // D5 — Depósitos e Experiência ATM
  { id: 'C5_1', name: 'Localização de ATM/agências',        dimensionId: 'D5', type: 'binary', question: 'A app tem funcionalidade de localização de ATM ou agências próximas?',         description: 'Verificar a existência de mapa ou lista de pontos de atendimento na app.' },
  { id: 'C5_2', name: 'Actualização de saldo pós-depósito', dimensionId: 'D5', type: 'scalar', question: 'Quão rápido o saldo actualiza após um depósito em ATM ou balcão?',             description: 'Avaliar a latência de actualização do saldo e clareza do movimento gerado.' },
  { id: 'C5_3', name: 'Comprovativo de depósito digital',   dimensionId: 'D5', type: 'binary', question: 'A app gera ou recebe comprovativo digital após operações de depósito?',        description: 'Testar se há notificação push ou registo de depósito consultável na app.' },

  // D6 — Atendimento e Suporte
  { id: 'C6_1', name: 'Chat in-app ou chatbot',             dimensionId: 'D6', type: 'binary', question: 'Existe canal de chat ou chatbot integrado directamente na app?',               description: 'Verificar a disponibilidade de suporte via chat sem sair da aplicação.' },
  { id: 'C6_2', name: 'Qualidade e rapidez do suporte',     dimensionId: 'D6', type: 'scalar', question: 'Qual a qualidade e rapidez de resposta dos canais de suporte disponíveis?',    description: 'Avaliar tempo de primeira resposta, resolução e adequação da ajuda prestada.' },
  { id: 'C6_3', name: 'FAQ e auto-atendimento digital',     dimensionId: 'D6', type: 'binary', question: 'Existe uma secção de FAQ ou auto-atendimento clara e útil dentro da app?',     description: 'Verificar a existência de uma secção de FAQ ou auto-atendimento dentro da app.' },

  // D7 — Confiança e Segurança Percebida
  { id: 'C7_1', name: 'Autenticação biométrica',            dimensionId: 'D7', type: 'binary', question: 'A app suporta autenticação por biometria (impressão digital ou face ID)?',     description: 'Verificar se o login biométrico está disponível e funcional.' },
  { id: 'C7_2', name: 'Notificações de segurança',          dimensionId: 'D7', type: 'scalar', question: 'Quão eficazes são as notificações para movimentos e alertas de segurança?',    description: 'Avaliar a qualidade, relevância e configurabilidade das notificações push.' },
  { id: 'C7_3', name: 'Limites visíveis e configuráveis',   dimensionId: 'D7', type: 'binary', question: 'Os limites de transferência/pagamento são visíveis e configuráveis pelo utilizador?', description: 'Verificar se o cliente pode consultar e ajustar os seus próprios limites.' },
  { id: 'C7_4', name: '2FA para operações sensíveis',       dimensionId: 'D7', type: 'binary', question: 'A app exige segundo factor de autenticação para operações de elevado valor?',   description: 'Testar se existe confirmação adicional (SMS, PIN, biometria) em transferências ou alterações de dados.' },

  // D8 — Performance e Estabilidade
  { id: 'C8_1', name: 'Velocidade de carregamento',         dimensionId: 'D8', type: 'scalar', question: 'Qual a velocidade geral de carregamento de ecrãs e resposta da app?',          description: 'Avaliar o tempo de arranque, transições entre ecrãs e carregamento de dados.' },
  { id: 'C8_2', name: 'Estabilidade (crashes e bugs)',      dimensionId: 'D8', type: 'scalar', question: 'Com que frequência ocorrem crashes, erros ou comportamentos inesperados?',     description: 'Registar ocorrências de erros, bloqueios e instabilidade durante a avaliação.' },
  { id: 'C8_3', name: 'Disponibilidade do serviço',         dimensionId: 'D8', type: 'binary', question: 'O serviço esteve sempre disponível durante o período de avaliação?',           description: 'Verificar se houve indisponibilidade, manutenção programada ou erros de conectividade.' },
  { id: 'C8_4', name: 'Mensagens de erro claras',           dimensionId: 'D8', type: 'binary', question: 'Quando ocorre um erro, a mensagem apresentada é clara e orienta o utilizador?', description: 'Testar se as mensagens de erro são compreensíveis e propõem acções de resolução.' },
];

export const CRITERIA_BY_DIMENSION: Record<string, Criterion[]> = DIMENSIONS.reduce((acc, d) => {
  acc[d.id] = CRITERIA.filter(c => c.dimensionId === d.id);
  return acc;
}, {} as Record<string, Criterion[]>);

// ─── Score labels ─────────────────────────────────────────────────────────────

export const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Não avaliado', color: '#494949', bg: '#f3f4f6' },
  1: { label: 'Muito Fraco',  color: '#ef4444', bg: '#fef2f2' },
  2: { label: 'Fraco',        color: '#f97316', bg: '#fff7ed' },
  3: { label: 'Adequado',     color: '#eab308', bg: '#fefce8' },
  4: { label: 'Bom',          color: '#22c55e', bg: '#f0fdf4' },
  5: { label: 'Excelente',    color: '#1ddbb1', bg: '#f0fdfa' },
};

export const TAGS = ['Fricção', 'Bug', 'Crítico', 'Quick Win', 'Boas Práticas'] as const;
export type Tag = typeof TAGS[number];

export const TAG_COLORS: Record<Tag, { bg: string; text: string }> = {
  'Fricção':        { bg: '#fef2f2', text: '#ef4444' },
  'Bug':            { bg: '#fff7ed', text: '#f97316' },
  'Crítico':        { bg: '#f1f5f9', text: '#334155' },
  'Quick Win':      { bg: '#f0fdf4', text: '#22c55e' },
  'Boas Práticas':  { bg: '#eff6ff', text: '#1818db' },
};

// ─── Banks ────────────────────────────────────────────────────────────────────

export interface Bank {
  id: string;
  name: string;
  shortName: string;
}

/** Default bank list — stored in AppState so it can be edited at runtime */
export const DEFAULT_BANKS: Bank[] = [
  { id: 'bai',       name: 'Banco Angolano de Investimentos',  shortName: 'BAI' },
  { id: 'bfa',       name: 'Banco de Fomento Angola',          shortName: 'BFA' },
  { id: 'bic',       name: 'Banco BIC Angola',                 shortName: 'BIC' },
  { id: 'economico', name: 'Banco Económico',                  shortName: 'Económico' },
  { id: 'atlantico', name: 'Banco Millennium Atlântico',       shortName: 'Atlântico' },
  { id: 'sol',       name: 'Banco Sol',                        shortName: 'SOL' },
  { id: 'keve',      name: 'Banco Keve',                       shortName: 'Keve' },
  { id: 'bpc',       name: 'Banco de Poupança e Crédito',      shortName: 'BPC' },
  { id: 'bca',       name: 'Banco Comercial Angolano',         shortName: 'BCA' },
  { id: 'bci',       name: 'Banco de Comércio e Indústria',    shortName: 'BCI' },
  { id: 'standard',  name: 'Standard Bank de Angola',          shortName: 'Standard' },
  { id: 'yetu',      name: 'Banco Yetu',                       shortName: 'Yetu' },
  { id: 'valor',     name: 'Banco Valor',                      shortName: 'Valor' },
  { id: 'prestigio', name: 'Banco Prestígio',                  shortName: 'Prestígio' },
  { id: 'bni',       name: 'Banco de Negócios Internacional',  shortName: 'BNI' },
  { id: 'caixa',     name: 'Banco Caixa Geral Angola',         shortName: 'Caixa' },
  { id: 'vtb',       name: 'VTB África',                       shortName: 'VTB' },
];

/** @deprecated use state.bankList instead */
export const BANKS = DEFAULT_BANKS;
