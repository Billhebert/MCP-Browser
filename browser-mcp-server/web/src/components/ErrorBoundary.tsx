import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-gray-900 rounded-xl border border-red-800/50 p-6 max-w-md text-center">
            <div className="text-3xl mb-3">💥</div>
            <h2 className="text-lg font-bold text-red-400 mb-2">Something broke</h2>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message || "Unknown error"}</p>
            <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
