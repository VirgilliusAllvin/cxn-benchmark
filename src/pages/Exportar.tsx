import { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { DIMENSIONS, CRITERIA } from '../lib/data';
import { getState } from '../lib/store';
import { globalScore100, dimensionScore } from '../lib/calculations';
import { PageHeader } from '../components/PageHeader';

function toCSV(rows: string[][]): string {
  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function download(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Exportar() {
  const [done, setDone] = useState<string | null>(null);

  function flash(key: string) {
    setDone(key);
    setTimeout(() => setDone(null), 2000);
  }

  function exportRanking() {
    const state = getState();
    const bankList = state.bankList;
    const rows: string[][] = [
      ['Posição', 'Banco', 'Nome Completo', 'Score Global (0-100)', 'Estado', ...DIMENSIONS.map(d => `${d.id} - ${d.shortName} (0-100)`)],
    ];
    const scored = bankList
      .filter(b => state.banks[b.id])
      .map(b => ({ b, data: state.banks[b.id], score: globalScore100(state.banks[b.id], state.dimensionWeights) }))
      .sort((a, b) => b.score - a.score);

    scored.forEach(({ b, data, score }, i) => {
      rows.push([
        String(i + 1),
        b.shortName,
        b.name,
        score.toFixed(1),
        data.status === 'approved' ? 'Aprovada' : data.status === 'submitted' ? 'Em Revisão' : 'Rascunho',
        ...DIMENSIONS.map(d => (Math.round(dimensionScore(data, d.id) * 20 * 10) / 10).toFixed(1)),
      ]);
    });
    download('cxn_ranking.csv', toCSV(rows));
    flash('ranking');
  }

  function exportFullScorecard() {
    const state = getState();
    const bankList = state.bankList;
    const rows: string[][] = [
      ['Banco', 'ID Critério', 'Critério', 'Dimensão', 'Tipo', 'Score', 'Dispositivo', 'Observações', 'Nº Evidências'],
    ];
    bankList.forEach(bank => {
      const bData = state.banks[bank.id];
      if (!bData) return;
      CRITERIA.forEach(criterion => {
        const cs = bData.criterionScores?.[criterion.id];
        const dim = DIMENSIONS.find(d => d.id === criterion.dimensionId);
        rows.push([
          bank.shortName,
          criterion.id,
          criterion.name,
          dim?.shortName ?? '',
          criterion.type === 'binary' ? 'Binário' : 'Escalar',
          String(cs?.score ?? 0),
          cs?.device ?? '',
          cs?.observations ?? '',
          String(cs?.evidences?.length ?? 0),
        ]);
      });
    });
    download('cxn_scorecard_completo.csv', toCSV(rows));
    flash('scorecard');
  }

  function exportBankScorecard(bankId: string) {
    const state = getState();
    const bank = state.bankList.find(b => b.id === bankId);
    if (!bank) return;
    const bData = state.banks[bankId];
    if (!bData) return;
    const rows: string[][] = [
      ['ID Critério', 'Critério', 'Dimensão', 'Peso Dimensão', 'Tipo', 'Score', 'Score (0-100)', 'Dispositivo', 'Observações'],
    ];
    CRITERIA.forEach(criterion => {
      const cs = bData.criterionScores?.[criterion.id];
      const dim = DIMENSIONS.find(d => d.id === criterion.dimensionId);
      const weight = state.dimensionWeights[criterion.dimensionId] ?? 0;
      const scoreVal = cs?.score ?? 0;
      rows.push([
        criterion.id,
        criterion.name,
        dim?.name ?? '',
        `${weight}%`,
        criterion.type === 'binary' ? 'Binário' : 'Escalar',
        String(scoreVal),
        String(Math.round(scoreVal * 20)),
        cs?.device ?? '',
        cs?.observations ?? '',
      ]);
    });
    download(`cxn_scorecard_${bank.shortName.toLowerCase()}.csv`, toCSV(rows));
    flash(`bank-${bankId}`);
  }

  const state = getState();
  const bankList = state.bankList;

  const EXPORT_CARDS = [
    {
      key: 'ranking',
      title: 'Ranking Geral',
      description: 'Todos os bancos com score global e score por dimensão, ordenados por posição.',
      icon: FileSpreadsheet,
      action: exportRanking,
    },
    {
      key: 'scorecard',
      title: 'Scorecard Completo',
      description: 'Todos os critérios de todos os bancos com scores, observações e dispositivos.',
      icon: FileSpreadsheet,
      action: exportFullScorecard,
    },
  ];

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader title="Exportar" subtitle="Exporte os dados em formato CSV para Excel ou análise externa" />

      {/* Main exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {EXPORT_CARDS.map(({ key, title, description, icon: Icon, action }) => (
          <div key={key} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <Icon size={20} style={{ color: '#1818db' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-black">{title}</h3>
                <p className="text-xs text-brand-gray mt-1 leading-relaxed">{description}</p>
              </div>
            </div>
            <button
              onClick={action}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-all w-full justify-center ${
                done === key
                  ? 'bg-green-500 text-white'
                  : 'bg-brand-blue text-white hover:bg-blue-700'
              }`}
            >
              {done === key ? <><CheckCircle size={14} /> Descarregado!</> : <><Download size={14} /> Descarregar CSV</>}
            </button>
          </div>
        ))}
      </div>

      {/* Per-bank exports */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold font-display text-brand-black">Scorecard por Banco</h2>
          <p className="text-xs text-brand-gray mt-1">Descarregue o ficheiro detalhado de cada banco individualmente.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {bankList.map(bank => {
            const k = `bank-${bank.id}`;
            const isDone = done === k;
            return (
              <button
                key={bank.id}
                onClick={() => exportBankScorecard(bank.id)}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-r border-gray-50 hover:bg-gray-50/50 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: '#1818db' }}>
                  {bank.shortName.charAt(0)}
                </div>
                <span className="text-xs font-medium text-brand-dark group-hover:text-brand-blue transition-colors flex-1 text-left">
                  {bank.shortName}
                </span>
                {isDone
                  ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                  : <Download size={13} className="text-brand-gray group-hover:text-brand-blue transition-colors shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
