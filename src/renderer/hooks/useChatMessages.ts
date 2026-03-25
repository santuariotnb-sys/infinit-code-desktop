import { useState, useRef, useCallback, useEffect } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useChatMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [claudeStatus, setClaudeStatus] = useState<'checking' | 'ready' | 'offline' | 'thinking'>('checking');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const streamingRef = useRef('');
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreaming = claudeStatus === 'thinking';

  // Segurança: se streaming ficar travado por 10 minutos, finaliza automaticamente
  useEffect(() => {
    if (claudeStatus === 'thinking') {
      streamingTimeoutRef.current = setTimeout(() => {
        const finalText = streamingRef.current;
        if (finalText) {
          setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: finalText }]);
        }
        streamingRef.current = '';
        setStreamingText('');
        setClaudeStatus('ready');
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'system', content: '⚠ Timeout: resposta interrompida após 10 minutos.' }]);
      }, 600_000);
    } else {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
    }
    return () => {
      if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
    };
  }, [claudeStatus]);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content }]);
  }, []);

  const addAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content }]);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'system', content }]);
  }, []);

  const startStreaming = useCallback(() => {
    streamingRef.current = '';
    setStreamingText('');
    setClaudeStatus('thinking');
  }, []);

  const appendChunk = useCallback((text: string) => {
    streamingRef.current += text;
    setStreamingText(streamingRef.current);
  }, []);

  const finishStreaming = useCallback((cost?: number, newSessionId?: string, silent = false) => {
    const finalText = streamingRef.current;
    if (finalText && !silent) addAssistantMessage(finalText);
    streamingRef.current = '';
    setStreamingText('');
    setClaudeStatus('ready');
    if (cost) setLastCost(cost);
    if (newSessionId) setSessionId(newSessionId);
  }, [addAssistantMessage]);

  const clearMessages = useCallback(async () => {
    await window.api.claude.clearSession?.();
    setSessionId(null);
    setMessages([]);
    setLastCost(null);
    streamingRef.current = '';
    setStreamingText('');
  }, []);

  return {
    messages,
    streamingText,
    claudeStatus,
    setClaudeStatus,
    sessionId,
    lastCost,
    isStreaming,
    addUserMessage,
    addSystemMessage,
    startStreaming,
    appendChunk,
    finishStreaming,
    clearMessages,
  };
}
