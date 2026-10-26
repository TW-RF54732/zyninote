import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Shows a render error in place instead of letting React unmount the whole app (a blank screen). Reset by remounting with a new key. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <pre className="zn-error">
        畫面發生錯誤：{error.message}
        {error.stack ? `\n\n${error.stack}` : ""}
      </pre>
    );
  }
}
