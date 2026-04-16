import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Qualcosa è andato storto</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>{this.state.error?.message}</div>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
