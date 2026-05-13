import { SCORE_LABELS } from '../lib/data';

interface Props {
  score: number;  // 0–5
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreBadge({ score, size = 'md', showLabel = false }: Props) {
  const s = Math.round(Math.max(0, Math.min(5, score)));
  const meta = SCORE_LABELS[s];

  const sizes = {
    sm: { fontSize: 11, padding: '2px 7px', borderRadius: 6 },
    md: { fontSize: 12, padding: '3px 9px', borderRadius: 7 },
    lg: { fontSize: 13, padding: '4px 11px', borderRadius: 8 },
  }[size];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
      color: meta.color, background: meta.bg,
      ...sizes,
    }}>
      <span>{s}</span>
      {showLabel && <span style={{ fontWeight: 500 }}>{meta.label}</span>}
    </span>
  );
}

interface Score100Props {
  score: number; // 0–100
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function scoreColor(v: number) {
  if (v === 0)  return { color: '#494949', bg: '#f3f4f6' };
  if (v < 20)   return { color: '#ef4444', bg: '#fef2f2' };
  if (v < 40)   return { color: '#f97316', bg: '#fff7ed' };
  if (v < 60)   return { color: '#eab308', bg: '#fefce8' };
  if (v < 80)   return { color: '#22c55e', bg: '#f0fdf4' };
  return               { color: '#1ddbb1', bg: '#f0fdfa' };
}

export function Score100Badge({ score, size = 'md', className = '' }: Score100Props) {
  const { color, bg } = scoreColor(score);

  const sizes = {
    sm: { fontSize: 11, padding: '2px 8px',  borderRadius: 6,  minWidth: 40 },
    md: { fontSize: 13, padding: '3px 10px', borderRadius: 7,  minWidth: 46 },
    lg: { fontSize: 15, padding: '4px 12px', borderRadius: 8,  minWidth: 52 },
    xl: { fontSize: 22, padding: '6px 16px', borderRadius: 10, minWidth: 70 },
  }[size];

  return (
    <span className={className} style={{
      display: 'inline-block', textAlign: 'center', fontWeight: 800,
      fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em',
      color, background: bg, ...sizes,
    }}>
      {score.toFixed(1)}
    </span>
  );
}
