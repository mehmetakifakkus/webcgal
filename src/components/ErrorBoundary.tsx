import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="error-boundary">
        <p>Something went wrong.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
