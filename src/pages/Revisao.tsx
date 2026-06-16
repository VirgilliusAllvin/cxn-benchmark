import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronRight, ClipboardCheck, Clock, AlertCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import { useSnapshot } from '../lib/store';
import { PageHeader } from '../components/PageHeader';
import { globalScore100, evaluatedCriterionCount } from '../lib/calculations';
import { CRITERIA } from '../lib/data';
import type { Evaluation } from '../lib/types';

const STATUS_CONFIG = {
  submitted: { label: 'Pendente', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: Clock },
  approved:  { label: 'Aprovada', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', icon: CheckCircle },
  rejected:  { label: 'Rejeitada', bg: 'bg-red-50',  text: 'text-red-600',   border: 'border-red-200',   icon: XCircle },
  draft:     { label: 'Rascunho', bg: 'bg-gray-50',  text: 'text-gray-500',  border: 'border-gray-200',  icon: AlertCircle },
};

interface RejectModalProps {
  evaluation: Evaluation;
  bankName: string;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}

function RejectModal({ evaluation: _ev, bankName, onConfirm, onClose }: RejectModalProps) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-md animate-fade-in">
        <h3 className="text-base font-bold text-brand-black mb-1">Rejeitar avaliação</h3>
        <p className="text-xs text-brand-gray mb-4">
          <span className="font-semibold text-brand-dark">{bankName}</span> — O agente irá receber o seu comentário.
        </p>
        <label className="block text-xs font-bold text-brand-dark mb-1.5">Motivo / Comentário</label>
        <textarea
          autoFocus
          rows={4}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Descreva o que precisa de ser corrigido..."
          className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onConfirm(comment.trim())}
            disabled={!comment.trim()}
            className="flex-1 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar rejeição
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 text-brand-dark rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function Revisao() {
  const state = useSnapshot();
  const { approve, reject } = useStore();
  const [rejectTarget, setRejectTarget] = useState<Evaluation | null>(null);
  const [filter, setFilter] = useState<'submitted' | 'all'>('submitted');

  const totalCriteria = CRITERIA.length;

  const evaluations = state.evaluations
    .filter(e => filter === 'all' || e.status === 'submitted')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const pendingCount = state.evaluations.filter(e => e.status === 'submitted').length;

  async function handleApprove(ev: Evaluation) {
    await approve(ev.id);
  }

  async function handleReject(comment: string) {
    if (!rejectTarget) return;
    await reject(rejectTarget.id, comment);
    setRejectTarget(null);
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Fila de Revisão"
        subtitle={`${pendingCount} avaliação${pendingCount !== 1 ? 'ões' : ''} pendente${pendingCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(['submitted', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  filter === f ? 'bg-brand-blue text-white' : 'text-brand-dark hover:bg-gray-100'
                }`}
              >
                {f === 'submitted' ? 'Pendentes' : 'Todas'}
              </button>
            ))}
          </div>
        }
      />

      {evaluations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-brand-gray">
          <ClipboardCheck size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">
            {filter === 'submitted' ? 'Nenhuma avaliação pendente de revisão.' : 'Nenhuma avaliação encontrada.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map(ev => {
            const bank = state.bankList.find(b => b.id === ev.bankId);
            const bData = state.banks[ev.bankId];
            const score = bData ? globalScore100(bData, state.dimensionWeights) : 0;
            const evaluated = bData ? evaluatedCriterionCount(bData) : 0;
            const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = cfg.icon;
            const updatedDate = new Date(ev.updatedAt).toLocaleDateString('pt-AO', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            });

            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex items-center gap-5"
              >
                {/* Bank avatar */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: '#1818db' }}>
                  {bank?.shortName?.charAt(0) ?? '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-brand-black">{bank?.shortName ?? ev.bankId}</span>
                    <span className="text-xs text-brand-gray">—</span>
                    <span className="text-xs text-brand-gray truncate">{bank?.name ?? ''}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-brand-gray flex-wrap">
                    <span>{evaluated}/{totalCriteria} critérios avaliados</span>
                    {score > 0 && <span className="font-semibold text-brand-dark">{score.toFixed(1)} pts</span>}
                    <span>{updatedDate}</span>
                  </div>
                  {ev.status === 'rejected' && ev.rejectionComment && (
                    <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold">Rejeitado: </span>{ev.rejectionComment}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} shrink-0`}>
                  <StatusIcon size={12} />
                  {cfg.label}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/banks/${ev.bankId}`}
                    className="text-xs text-brand-blue hover:underline flex items-center gap-1"
                  >
                    Ver detalhe <ChevronRight size={11} />
                  </Link>

                  {ev.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => handleApprove(ev)}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle size={12} /> Aprovar
                      </button>
                      <button
                        onClick={() => setRejectTarget(ev)}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={12} /> Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de rejeição */}
      {rejectTarget && (
        <RejectModal
          evaluation={rejectTarget}
          bankName={state.bankList.find(b => b.id === rejectTarget.bankId)?.name ?? rejectTarget.bankId}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
