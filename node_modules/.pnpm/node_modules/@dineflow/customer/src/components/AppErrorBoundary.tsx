import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('Customer app render crash', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
            <h1 className="text-lg font-black text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">
              We hit an unexpected issue while rendering this page.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
