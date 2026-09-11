"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  objectId: string;
  /**
   * Changes only when what the object is made of changes: a different file, a
   * different preset. That is the moment a failed object deserves another try.
   * Comparing children instead would reset on every parent render, and the
   * error would be wiped the instant it was shown.
   */
  resetKey: string;
  onError: (id: string, message: string | null) => void;
  children: ReactNode;
};
type State = { failed: boolean };

/**
 * Keeps one broken object (a corrupt import, an unknown preset) from taking the
 * whole canvas down. The message is surfaced in the object panel.
 */
export class ObjectBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Object ${this.props.objectId} failed to render`, error, info);
    this.props.onError(this.props.objectId, error.message || "This object could not be rendered");
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
      this.props.onError(this.props.objectId, null);
    }
  }

  componentWillUnmount() {
    this.props.onError(this.props.objectId, null);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
