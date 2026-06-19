import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-brand-bg">
          <div
            className="flex flex-col items-center gap-5 rounded-2xl p-10 max-w-md w-full mx-4"
            style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 48, height: 48, background: '#1818db' }}
            >
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em' }}>CX</span>
            </div>
            <div className="text-center">
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  color: '#161616',
                  marginBottom: 8,
                }}
              >
                Algo correu mal
              </h1>
              <p style={{ fontSize: 14, color: '#999999', lineHeight: 1.5 }}>
                Ocorreu um erro inesperado. Recarregue a página para continuar.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1818db' }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
