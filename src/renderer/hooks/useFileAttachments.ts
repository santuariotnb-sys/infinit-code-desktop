import { useState, useCallback } from 'react';
import { basename } from '../utils/path';

export interface AttachedFile {
  name: string;
  content: string;
  type: 'file' | 'screenshot';
}

function flattenTree(nodes: { name: string; path: string; type: string; children?: { name: string; path: string; type: string }[] }[]): string[] {
  const result: string[] = [];
  function walk(items: typeof nodes) {
    for (const n of items) {
      if (n.type === 'file') result.push(n.path);
      if (n.children) walk(n.children as typeof nodes);
    }
  }
  walk(nodes);
  return result;
}

interface UseFileAttachmentsOptions {
  projectPath: string | null;
  activeFile: { path: string; content: string } | null;
  inputValue: string;
  onInputChange: (val: string) => void;
}

export function useFileAttachments({ projectPath, activeFile, inputValue, onInputChange }: UseFileAttachmentsOptions) {
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [mentionFiles, setMentionFiles] = useState<string[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionCursor, setMentionCursor] = useState(0);

  const handleInputChange = useCallback(async (val: string) => {
    onInputChange(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx >= 0 && projectPath) {
      const query = val.slice(atIdx + 1).toLowerCase();
      try {
        const result = await window.api.files.readDir(projectPath);
        const tree = result?.ok ? (result.data ?? []) : [];
        const flat = flattenTree(tree).filter((p) => p.toLowerCase().includes(query)).slice(0, 8);
        setMentionFiles(flat);
        setShowMentionList(flat.length > 0);
        setMentionCursor(0);
      } catch { /* ignore */ }
    } else {
      setShowMentionList(false);
    }
  }, [projectPath, onInputChange]);

  async function insertMention(filePath: string) {
    try {
      const result = await window.api.files.read(filePath);
      const content = result?.ok ? (result.data ?? '') : '';
      const name = basename(filePath);
      setAttached((prev) => [...prev, { name, content, type: 'file' }]);
      const atIdx = inputValue.lastIndexOf('@');
      onInputChange(inputValue.slice(0, atIdx));
      setShowMentionList(false);
    } catch { /* ignore */ }
  }

  function attachActiveFile() {
    if (!activeFile) return;
    const name = basename(activeFile.path);
    const lines = activeFile.content.split('\n').slice(0, 200).join('\n');
    setAttached((prev) => [...prev, { name, content: lines, type: 'file' }]);
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttached((prev) => [...prev, { name: file.name, content: ev.target?.result as string, type: 'file' }]);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function captureScreenshot() {
    try {
      const b64 = await window.api.screenshot();
      setAttached((prev) => [...prev, { name: 'screenshot.png', content: b64, type: 'screenshot' }]);
    } catch { /* ignore */ }
  }

  function removeAttachment(index: number) {
    setAttached((prev) => prev.filter((_, j) => j !== index));
  }

  function clearAttachments() {
    setAttached([]);
  }

  function addAttachment(file: AttachedFile) {
    setAttached((prev) => [...prev, file]);
  }

  return {
    attached,
    mentionFiles,
    showMentionList,
    setShowMentionList,
    mentionCursor,
    setMentionCursor,
    handleInputChange,
    insertMention,
    attachActiveFile,
    handleFileAttach,
    captureScreenshot,
    removeAttachment,
    clearAttachments,
    addAttachment,
  };
}
