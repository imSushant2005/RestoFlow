import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type DashboardErrorBoundaryProps = {
  children: ReactNode;
};

type DashboardErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): DashboardErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected runtime error',
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('[DashboardErrorBoundary]', error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Dashboard recovered from a crash</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                We caught a runtime error so the app doesn&apos;t go blank.
              </p>
              <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                {this.state.message || 'Unknown error'}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={this.retry}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Hard Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
