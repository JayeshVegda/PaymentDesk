import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('Payment Ledger render failed', error);
  }

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-screen bg-bg-page grid place-items-center p-6">
        <section className="ledger-card max-w-lg text-center" role="alert">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-danger-red">
            <AlertTriangle aria-hidden="true" size={24} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-text-primary text-balance">
            This screen could not load
          </h1>
          <p className="mt-2 text-sm text-text-secondary text-pretty">
            Refresh the page. If the problem continues, open another section and try again.
          </p>
          <button className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh Payment Ledger
          </button>
        </section>
      </main>
    );
  }
}
