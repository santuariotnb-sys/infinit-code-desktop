import React from 'react';

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <span style={styles.icon}>⚠</span>
          <p style={styles.title}>{this.props.name} falhou</p>
          <p style={styles.message}>{this.state.message}</p>
          <button
            style={styles.retry}
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 24, background: '#0a0a0a',
  },
  icon: { fontSize: 28, color: '#ff4444' },
  title: { color: '#ccc', fontSize: 13, fontWeight: 600, margin: 0 },
  message: { color: '#555', fontSize: 11, margin: 0, textAlign: 'center', maxWidth: 240 },
  retry: {
    marginTop: 8, padding: '6px 16px', background: 'none',
    border: '1px solid #333', borderRadius: 6, color: '#888',
    fontSize: 12, cursor: 'pointer',
  },
};
