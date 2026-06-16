import { useMemo, useState } from 'react';
import { Link2, FileText, Trash2, Filter, Image as ImageIcon } from 'lucide-react';
import { DIMENSIONS, CRITERIA, TAGS, TAG_COLORS } from '../lib/data';
import { useStore } from '../lib/store';
import { PageHeader } from '../components/PageHeader';
import type { Tag } from '../lib/data';

export function Evidencias() {
  const { state, removeEvidence } = useStore();
  const [filterBank, setFilterBank] = useState('all');
  const [filterTag, setFilterTag] = useState<Tag | 'all'>('all');

  const bankList = state.bankList;

  // Gather all evidences — derivar bankId a partir da iteração
  const allEvidences = useMemo(() => {
    const evs: Array<{
      id: string;
      evaluationId: string;
      bankId: string;
      bankName: string;
      criterionId: string;
      criterionName: string;
      dimId: string;
      type: 'link' | 'note' | 'image';
      content: string;
      description: string;
      collectedAt: string;
      tags: Tag[];
    }> = [];
    bankList.forEach(bank => {
      const bData = state.banks[bank.id];
      if (!bData) return;
      CRITERIA.forEach(criterion => {
        const cs = bData.criterionScores?.[criterion.id];
        (cs?.evidences ?? []).forEach(ev => {
          evs.push({
            id: ev.id,
            evaluationId: ev.evaluationId,
            bankId: bank.id,
            bankName: bank.shortName,
            criterionId: ev.criterionId,
            criterionName: criterion.name,
            dimId: criterion.dimensionId,
            type: ev.type,
            content: ev.content,
            description: ev.description,
            collectedAt: ev.collectedAt,
            tags: ev.tags as Tag[],
          });
        });
      });
    });
    return evs.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  }, [state, bankList]);

  const filtered = useMemo(() => allEvidences.filter(ev => {
    const matchBank = filterBank === 'all' || ev.bankId === filterBank;
    const matchTag = filterTag === 'all' || ev.tags.includes(filterTag);
    return matchBank && matchTag;
  }), [allEvidences, filterBank, filterTag]);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <PageHeader
        title="Galeria de Evidências"
        subtitle={`${allEvidences.length} evidências registadas`}
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-brand-gray" />
          <select
            value={filterBank}
            onChange={e => setFilterBank(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all"
          >
            <option value="all">Todos os Bancos</option>
            {bankList.map(b => <option key={b.id} value={b.id}>{b.shortName}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTag('all')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterTag === 'all' ? 'bg-brand-black text-white' : 'bg-white border border-gray-200 text-brand-dark'
            }`}
          >
            Todas as Tags
          </button>
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? 'all' : tag)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all border"
              style={{
                background: filterTag === tag ? TAG_COLORS[tag].bg : 'white',
                color: filterTag === tag ? TAG_COLORS[tag].text : '#494949',
                borderColor: filterTag === tag ? TAG_COLORS[tag].text + '40' : '#e5e7eb',
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-brand-gray">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <FileText size={32} className="mx-auto mb-3 text-brand-gray opacity-30" />
          <p className="text-sm text-brand-gray">Nenhuma evidência encontrada</p>
          <p className="text-xs text-brand-gray mt-1">Adicione evidências durante a avaliação dos bancos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ev => {
            const dim = DIMENSIONS.find(d => d.id === ev.dimId);
            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card hover:shadow-card-hover transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: '#1818db' }}>
                      {ev.bankName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-black">{ev.bankName}</div>
                      <div className="text-[10px] text-brand-gray">{ev.criterionName}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeEvidence(ev.evaluationId, ev.criterionId, ev.id)}
                    className="text-brand-gray hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Dim badge */}
                {dim && (
                  <div className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-flex mb-2"
                    style={{ background: dim.color + '15', color: dim.color }}>
                    {dim.shortName}
                  </div>
                )}

                {/* Content */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    {ev.type === 'image'
                      ? <ImageIcon size={11} className="text-violet-500 shrink-0" />
                      : ev.type === 'link'
                        ? <Link2 size={11} className="text-brand-blue shrink-0" />
                        : <FileText size={11} className="text-brand-gray shrink-0" />}
                    <span className="text-[10px] font-medium text-brand-gray uppercase tracking-wide">
                      {ev.type === 'link' ? 'Link' : ev.type === 'image' ? 'Imagem' : 'Nota'}
                    </span>
                  </div>
                  {ev.type === 'image' ? (
                    <a href={ev.content} target="_blank" rel="noopener noreferrer">
                      <img src={ev.content} alt="evidência" className="w-full h-32 object-cover rounded-lg border border-gray-100" />
                    </a>
                  ) : ev.type === 'link' ? (
                    <a href={ev.content} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-blue hover:underline break-all line-clamp-2">
                      {ev.content}
                    </a>
                  ) : (
                    <p className="text-xs text-brand-dark line-clamp-3">{ev.content}</p>
                  )}
                </div>

                {ev.description && (
                  <p className="text-[11px] text-brand-gray mb-2 line-clamp-2">{ev.description}</p>
                )}

                {/* Tags */}
                {ev.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ev.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: TAG_COLORS[tag]?.bg ?? '#f3f4f6', color: TAG_COLORS[tag]?.text ?? '#6b7280' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-brand-gray border-t border-gray-100 pt-2 mt-2">
                  {new Date(ev.collectedAt).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
