import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 md:mb-8">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', color: '#161616', marginBottom: 4 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: '#999999', fontWeight: 400 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
