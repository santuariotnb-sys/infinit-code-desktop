// ── aiProviders.ts ────────────────────────────────────────────────
// Providers de IA via API HTTP: Gemini, Groq, OpenRouter.
// Streaming por IPC event 'aiProvider:chunk', igual ao Claude.

import { ipcMain, BrowserWindow } from 'electron';
import https from 'https';
import { getSecret, setSecret } from '../services/keychain';

// Conjunto de providers válidos — impede injeção de providers arbitrários
const VALID_PROVIDERS = new Set<string>(['gemini', 'groq', 'openrouter']);

// Modelos válidos por provider — impede enviar model IDs arbitrários para a API
const VALID_MODEL_PREFIXES: Record<string, string[]> = {
  gemini: ['gemini-'],
  groq: ['llama-', 'mixtral-', 'deepseek-', 'gemma-', 'whisper-'],
  openrouter: ['google/', 'anthropic/', 'meta-llama/', 'deepseek/', 'mistralai/', 'openai/'],
};

function isValidModel(provider: string, model: string): boolean {
  const prefixes = VALID_MODEL_PREFIXES[provider];
  if (!prefixes) return false;
  return prefixes.some(p => model.startsWith(p));
}

// Comprimento máximo de prompt para evitar payloads gigantes
const MAX_PROMPT_CHARS = 100_000;

export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export interface ProviderModel {
  id: string;
  label: string;
}

export const PROVIDER_MODELS: Record<ProviderId, ProviderModel[]> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash ⚡' },
    { id: 'gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B ⚡' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (rápido)' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B' },
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
    { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  ],
};

// ── HTTP streaming helper ─────────────────────────────────────────
function httpsPost(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  body: string,
  onChunk: (text: string) => void,
  onError: (msg: string) => void,
  onDone: () => void,
  signal?: { cancelled: boolean },
): void {
  const req = https.request(
    { hostname, path, method: 'POST', headers },
    (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = '';
        res.on('data', (c: Buffer) => { errBody += c.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(errBody);
            onError(json?.error?.message || json?.message || `Erro HTTP ${res.statusCode}`);
          } catch {
            onError(`Erro HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`);
          }
        });
        return;
      }

      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        if (signal?.cancelled) { req.destroy(); return; }
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            // OpenAI-compatible (Groq, OpenRouter)
            const content = event?.choices?.[0]?.delta?.content;
            if (typeof content === 'string') { onChunk(content); continue; }
            // Gemini
            const parts = event?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p?.text === 'string') onChunk(p.text);
              }
            }
          } catch { /* chunk parcial */ }
        }
      });
      res.on('end', () => { if (!signal?.cancelled) onDone(); });
      res.on('error', (e: Error) => onError(e.message));
    },
  );
  req.on('error', (e: Error) => {
    if (signal?.cancelled) return;
    onError(e.message);
  });
  req.write(body);
  req.end();
}

// ── Builders de request por provider ─────────────────────────────
function buildGeminiRequest(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  history: Array<{ role: string; content: string }>,
) {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const h of history) {
    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
  }
  contents.push({ role: 'user', parts: [{ text: userPrompt }] });

  const body = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
  });

  return {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body).toString() },
    body,
  };
}

function buildOpenAICompatRequest(
  hostname: string,
  path: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  history: Array<{ role: string; content: string }>,
  extraHeaders?: Record<string, string>,
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: userPrompt },
  ];

  const body = JSON.stringify({ model, messages, stream: true, max_tokens: 8192 });

  return {
    hostname,
    path,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body).toString(),
      ...(extraHeaders ?? {}),
    },
    body,
  };
}

// ── Cancelamento ─────────────────────────────────────────────────
const activeRequests = new Map<number, { cancelled: boolean }>();

export function registerAIProviderHandlers(mainWindow: BrowserWindow): void {
  // Salvar API key de um provider
  ipcMain.handle('aiProvider:save-key', async (_event, provider: ProviderId, key: string) => {
    try {
      setSecret(`ai-provider-${provider}`, key);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  // Ler API key armazenada
  ipcMain.handle('aiProvider:get-key', async (_event, provider: ProviderId) => {
    try {
      const key = getSecret(`ai-provider-${provider}`);
      return { ok: true, key: key ?? '' };
    } catch {
      return { ok: true, key: '' };
    }
  });

  // Lista providers e modelos disponíveis
  ipcMain.handle('aiProvider:models', async () => {
    return PROVIDER_MODELS;
  });

  // Enviar prompt e receber resposta com streaming
  ipcMain.handle('aiProvider:ask', async (_event, payload: {
    provider: ProviderId;
    model: string;
    prompt: string;
    systemPrompt?: string;
    history?: Array<{ role: string; content: string }>;
  }) => {
    const { provider, model, prompt, systemPrompt = '', history = [] } = payload;
    const windowId = mainWindow.id;

    const apiKey = getSecret(`ai-provider-${provider}`) ?? '';
    if (!apiKey) {
      return { ok: false, error: `API key do ${provider} não configurada. Clique no ícone ⚙ para configurar.` };
    }

    const signal = { cancelled: false };
    activeRequests.set(windowId, signal);

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const onChunk = (text: string) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('aiProvider:chunk', { text });
        }
      };
      const onError = (msg: string) => {
        activeRequests.delete(windowId);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('aiProvider:error', { message: msg });
        }
        resolve({ ok: false, error: msg });
      };
      const onDone = () => {
        activeRequests.delete(windowId);
        resolve({ ok: true });
      };

      try {
        if (provider === 'gemini') {
          const { hostname, path, headers, body } = buildGeminiRequest(model, apiKey, systemPrompt, prompt, history);
          httpsPost(hostname, path, headers, body, onChunk, onError, onDone, signal);
        } else if (provider === 'groq') {
          const { hostname, path, headers, body } = buildOpenAICompatRequest(
            'api.groq.com', '/openai/v1/chat/completions', apiKey, model, systemPrompt, prompt, history,
          );
          httpsPost(hostname, path, headers, body, onChunk, onError, onDone, signal);
        } else if (provider === 'openrouter') {
          const { hostname, path, headers, body } = buildOpenAICompatRequest(
            'openrouter.ai', '/api/v1/chat/completions', apiKey, model, systemPrompt, prompt, history,
            { 'HTTP-Referer': 'https://app-infinitcode.netlify.app', 'X-Title': 'Infinit Code' },
          );
          httpsPost(hostname, path, headers, body, onChunk, onError, onDone, signal);
        } else {
          resolve({ ok: false, error: `Provider desconhecido: ${provider}` });
        }
      } catch (error) {
        resolve({ ok: false, error: (error as Error).message });
      }
    });
  });

  // Cancelar request ativo
  ipcMain.handle('aiProvider:cancel', async () => {
    const signal = activeRequests.get(mainWindow.id);
    if (signal) {
      signal.cancelled = true;
      activeRequests.delete(mainWindow.id);
    }
    return { ok: true };
  });

  // ── Transcrição de áudio via Groq Whisper ────────────────────────
  // Recebe áudio como Buffer (WebM/Opus gravado pelo MediaRecorder)
  // e envia para Groq Whisper API. Não depende do Web Speech API do Google.
  ipcMain.handle('aiProvider:transcribe', async (_event, audioBuffer: Buffer, lang = 'pt') => {
    const apiKey = await getSecret('groq');
    if (!apiKey) return { ok: false, error: 'Chave Groq não configurada. Adicione em Configurações → Groq API Key.' };

    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const filename = 'audio.webm';
    const model = 'whisper-large-v3';

    // Monta multipart/form-data manualmente
    const parts: Buffer[] = [];
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`));
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    return new Promise<{ ok: boolean; text?: string; error?: string }>((resolve) => {
      const req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.text) resolve({ ok: true, text: json.text });
            else resolve({ ok: false, error: json?.error?.message || 'Transcrição vazia' });
          } catch {
            resolve({ ok: false, error: `Resposta inválida: ${data.slice(0, 100)}` });
          }
        });
      });
      req.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
      req.write(body);
      req.end();
    });
  });
}

