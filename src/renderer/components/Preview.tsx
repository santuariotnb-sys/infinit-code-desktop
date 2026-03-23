import React, { useState } from 'react';

interface PreviewProps {
  port: number;
  onPortChange: (port: number) => void;
}

export default function Preview({ port, onPortChange }: PreviewProps) {
  const [inputPort, setInputPort] = useState(String(port));
  const [key, setKey] = useState(0);

  function handleRefresh() {
    setKey((k) => k + 1);
  }

  function handlePortSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(inputPort, 10);
    if (p > 0 && p < 65536) {
      onPortChange(p);
      setKey((k) => k + 1);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <form onSubmit={handlePortSubmit} style={styles.portForm}>
          <span style={styles.portLabel}>localhost:</span>
          <input
            type="text"
            value={inputPort}
            onChange={(e) => setInputPort(e.target.value)}
            style={styles.portInput}
          />
        </form>
        <button onClick={handleRefresh} style={styles.refreshBtn} title="Atualizar">
          ↻
        </button>
      </div>
      <iframe
        key={key}
        src={`http://localhost:${port}`}
        style={styles.iframe}
        sandbox="allow-same-origin allow-scripts allow-forms"
        title="Preview"
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: '#111',
    borderBottom: '1px solid #2a2a2a',
  },
  portForm: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  portLabel: {
    color: '#555',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  portInput: {
    background: 'transparent',
    border: 'none',
    color: '#00ff88',
    fontSize: '12px',
    fontFamily: 'monospace',
    width: '50px',
    outline: 'none',
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  iframe: {
    flex: 1,
    border: 'none',
    background: '#fff',
    width: '100%',
  },
};
