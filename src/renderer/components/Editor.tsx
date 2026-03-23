import React, { useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
  filePath: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
    xml: 'xml',
    svg: 'xml',
    graphql: 'graphql',
  };
  return map[ext] || 'plaintext';
}

export default function Editor({ filePath, content, onChange }: EditorProps) {
  const editorRef = useRef<any>(null);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MonacoEditor
        height="100%"
        language={getLanguage(filePath)}
        theme="vs-dark"
        value={content}
        onChange={onChange}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12 },
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: 'always',
          formatOnPaste: true,
          tabSize: 2,
          wordWrap: 'on',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
      />
    </div>
  );
}
