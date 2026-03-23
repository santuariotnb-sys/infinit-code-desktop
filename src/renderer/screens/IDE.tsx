import React, { useState, useEffect, useCallback } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}
import FileTree from '../components/FileTree';
import Editor from '../components/Editor';
import Terminal from '../components/Terminal';
import Preview from '../components/Preview';
import IntelliChat from '../components/IntelliChat';
import Toolbar from '../components/Toolbar';

export default function IDE() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [modified, setModified] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [previewPort, setPreviewPort] = useState(3000);
  const [sidebarWidth] = useState(240);
  const [terminalHeight] = useState(250);

  const loadFiles = useCallback(async (dirPath: string) => {
    try {
      const tree = await window.api.files.readDir(dirPath);
      setFiles(tree);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    if (projectPath) {
      loadFiles(projectPath);
      window.api.terminal.create(projectPath);
      window.api.files.watch(projectPath);

      const cleanup = window.api.files.onChanged(() => {
        loadFiles(projectPath);
      });

      return cleanup;
    }
  }, [projectPath, loadFiles]);

  async function handleOpenFolder() {
    const path = await window.api.files.openDialog();
    if (path) {
      setProjectPath(path);
      setOpenFile(null);
      setFileContent('');
    }
  }

  async function handleSelectFile(filePath: string) {
    if (modified && openFile) {
      await handleSave();
    }
    try {
      const content = await window.api.files.read(filePath);
      setOpenFile(filePath);
      setFileContent(content);
      setModified(false);
    } catch {
      // file may not be readable
    }
  }

  async function handleSave() {
    if (openFile && modified) {
      await window.api.files.write(openFile, fileContent);
      setModified(false);
    }
  }

  function handleContentChange(value: string | undefined) {
    if (value !== undefined) {
      setFileContent(value);
      setModified(true);
    }
  }

  function handleSendToTerminal(command: string) {
    window.api.terminal.write(command + '\r');
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openFile, fileContent, modified]);

  if (!projectPath) {
    return (
      <div style={styles.welcome}>
        <div style={styles.welcomeContent}>
          <span style={styles.welcomeIcon}>∞</span>
          <h1 style={styles.welcomeTitle}>Infinit Code</h1>
          <p style={styles.welcomeText}>Abra uma pasta para comecar</p>
          <button style={styles.openButton} onClick={handleOpenFolder}>
            Abrir Pasta
          </button>
        </div>
      </div>
    );
  }

  const fileName = openFile ? openFile.split('/').pop() || '' : '';

  return (
    <div style={styles.container}>
      <Toolbar
        projectPath={projectPath}
        fileName={fileName}
        modified={modified}
        onSave={handleSave}
        onOpenFolder={handleOpenFolder}
        onTogglePreview={() => setShowPreview(!showPreview)}
        onToggleChat={() => setShowChat(!showChat)}
        showPreview={showPreview}
        showChat={showChat}
      />

      <div style={styles.main}>
        {/* Sidebar */}
        <div style={{ ...styles.sidebar, width: sidebarWidth }}>
          <FileTree
            files={files}
            selectedFile={openFile}
            onSelectFile={handleSelectFile}
          />
        </div>

        {/* Editor area */}
        <div style={styles.editorArea}>
          <div style={{ ...styles.editorPane, marginBottom: terminalHeight }}>
            {openFile ? (
              <Editor
                filePath={openFile}
                content={fileContent}
                onChange={handleContentChange}
              />
            ) : (
              <div style={styles.noFile}>
                <p style={styles.noFileText}>Selecione um arquivo para editar</p>
              </div>
            )}
          </div>

          {/* Terminal */}
          <div style={{ ...styles.terminal, height: terminalHeight }}>
            <Terminal />
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div style={styles.previewPanel}>
            <Preview port={previewPort} onPortChange={setPreviewPort} />
          </div>
        )}

        {/* Chat panel */}
        {showChat && (
          <div style={styles.chatPanel}>
            <IntelliChat onSendCommand={handleSendToTerminal} />
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    background: '#111',
    borderRight: '1px solid #2a2a2a',
    overflow: 'auto',
    flexShrink: 0,
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    minWidth: 0,
  },
  editorPane: {
    flex: 1,
    overflow: 'hidden',
  },
  terminal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTop: '1px solid #2a2a2a',
    background: '#0a0a0a',
  },
  previewPanel: {
    width: '400px',
    borderLeft: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  chatPanel: {
    width: '350px',
    borderLeft: '1px solid #2a2a2a',
    flexShrink: 0,
    background: '#111',
  },
  noFile: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFileText: {
    color: '#555',
    fontSize: '14px',
  },
  welcome: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  welcomeContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  welcomeIcon: {
    fontSize: '64px',
    color: '#00ff88',
  },
  welcomeTitle: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
  },
  welcomeText: {
    color: '#888',
    fontSize: '16px',
  },
  openButton: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    padding: '14px 40px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
