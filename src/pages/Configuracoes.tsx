import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { DIMENSIONS, DEFAULT_DIMENSION_WEIGHTS } from '../lib/data';
import { useStore } from '../lib/store';
import { PageHeader } from '../components/PageHeader';

function genId(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20) + '_' + Math.random().toString(36).slice(2, 6);
}

export function Configuracoes() {
  const { state, addBank, updateBankRecord, removeBank, updateDimensionWeights } = useStore();
  const bankList = state.bankList;

  // ── Bank editing state ───────────────────────────────────────────────────────
  const [newBankName, setNewBankName] = useState('');
  const [newBankShort, setNewBankShort] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editShort, setEditShort] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Weights editing state ────────────────────────────────────────────────────
  const [weights, setWeights] = useState<Record<string, number>>({ ...state.dimensionWeights });
  const [weightsSaved, setWeightsSaved] = useState(false);

  // Sync weights from state when changed externally
  useEffect(() => {
    setWeights({ ...state.dimensionWeights });
  }, [state.dimensionWeights]);

  const weightSum = Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0);
  const weightsValid = Math.round(weightSum) === 100;

  // ── Bank actions ─────────────────────────────────────────────────────────────
  function handleAddBank() {
    const name = newBankName.trim();
    const shortName = newBankShort.trim();
    if (!name || !shortName) return;
    addBank({ id: genId(name), name, shortName });
    setNewBankName('');
    setNewBankShort('');
  }

  function startEdit(bank: { id: string; name: string; shortName: string }) {
    setEditingId(bank.id);
    setEditName(bank.name);
    setEditShort(bank.shortName);
  }

  function saveEdit() {
    if (!editingId) return;
    updateBankRecord(editingId, { name: editName.trim(), shortName: editShort.trim() });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      removeBank(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  // ── Weight actions ────────────────────────────────────────────────────────────
  function handleWeightChange(dimId: string, val: string) {
    setWeights(w => ({ ...w, [dimId]: Number(val) || 0 }));
    setWeightsSaved(false);
  }

  function handleSaveWeights() {
    if (!weightsValid) return;
    updateDimensionWeights(weights);
    setWeightsSaved(true);
    setTimeout(() => setWeightsSaved(false), 2000);
  }

  function resetWeights() {
    setWeights({ ...DEFAULT_DIMENSION_WEIGHTS });
    setWeightsSaved(false);
  }

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Configurações" subtitle="Gerir bancos e pesos das dimensões" />

      {/* ── Banks section ────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-brand-black mb-4">Bancos em Análise</h2>
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {/* Add bank form */}
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-brand-dark mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                  placeholder="ex: Banco Angolano de Investimentos"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                  onKeyDown={e => e.key === 'Enter' && handleAddBank()}
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-bold text-brand-dark mb-1.5">Nome Curto</label>
                <input
                  type="text"
                  value={newBankShort}
                  onChange={e => setNewBankShort(e.target.value)}
                  placeholder="ex: BAI"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                  onKeyDown={e => e.key === 'Enter' && handleAddBank()}
                />
              </div>
              <button
                onClick={handleAddBank}
                disabled={!newBankName.trim() || !newBankShort.trim()}
                className="flex items-center gap-2 text-sm bg-brand-blue text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          {/* Bank list */}
          <div className="divide-y divide-gray-50">
            {bankList.map(bank => (
              <div key={bank.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: '#1818db' }}>
                  {bank.shortName.charAt(0)}
                </div>

                {editingId === bank.id ? (
                  <>
                    <input
                      className="flex-1 text-sm border border-brand-blue/40 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                    <input
                      className="w-28 text-sm border border-brand-blue/40 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                      value={editShort}
                      onChange={e => setEditShort(e.target.value)}
                    />
                    <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-brand-gray hover:bg-gray-100 rounded-lg transition-colors">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-brand-black">{bank.name}</div>
                      <div className="text-xs text-brand-gray font-mono">{bank.id}</div>
                    </div>
                    <div className="text-xs font-bold text-brand-dark w-20 shrink-0">{bank.shortName}</div>
                    <button
                      onClick={() => startEdit(bank)}
                      className="p-1.5 text-brand-gray hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(bank.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        confirmDelete === bank.id
                          ? 'text-red-600 bg-red-50'
                          : 'text-brand-gray hover:text-red-500 hover:bg-red-50'
                      }`}
                      title={confirmDelete === bank.id ? 'Clique novamente para confirmar' : 'Eliminar banco'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100">
            <span className="text-xs text-brand-gray">{bankList.length} banco{bankList.length !== 1 ? 's' : ''} configurado{bankList.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </section>

      {/* ── Dimension Weights section ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-brand-black">Pesos das Dimensões</h2>
            <p className="text-xs text-brand-gray mt-0.5">Os pesos devem somar exactamente 100%.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetWeights}
              className="flex items-center gap-1.5 text-xs text-brand-gray hover:text-brand-dark border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw size={12} /> Repor padrão
            </button>
            <button
              onClick={handleSaveWeights}
              disabled={!weightsValid}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-all ${
                weightsSaved
                  ? 'bg-green-500 text-white'
                  : weightsValid
                    ? 'bg-brand-blue text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {weightsSaved ? <><Check size={14} /> Guardado!</> : <><Save size={14} /> Guardar Pesos</>}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {DIMENSIONS.map(dim => (
              <div key={dim.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: dim.color }}>
                  {dim.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-brand-black">{dim.name}</div>
                  <div className="text-xs text-brand-gray mt-0.5">{dim.description}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[dim.id] ?? 0}
                    onChange={e => handleWeightChange(dim.id, e.target.value)}
                    className="w-16 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all font-bold"
                  />
                  <span className="text-sm text-brand-gray font-medium">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sum indicator */}
          <div className={`px-5 py-3 border-t flex items-center justify-between ${
            weightsValid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
          }`}>
            <div className="flex items-center gap-2">
              {weightsValid
                ? <Check size={14} className="text-green-600" />
                : <AlertCircle size={14} className="text-red-500" />}
              <span className={`text-xs font-medium ${weightsValid ? 'text-green-700' : 'text-red-600'}`}>
                {weightsValid ? 'Soma correcta' : `Soma actual: ${weightSum}% (deve ser 100%)`}
              </span>
            </div>
            <span className={`text-lg font-bold ${weightsValid ? 'text-green-700' : 'text-red-600'}`}>
              {weightSum}%
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
