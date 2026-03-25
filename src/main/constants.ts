// Constantes globais do processo main
// Centraliza magic numbers para facilitar ajuste e evitar duplicação

export const TIMEOUTS = {
  /** Timeout máximo para o Claude responder (5 minutos) */
  CLAUDE_MAX_MS: 300_000,
  /** Aviso de lentidão do Claude (1 minuto) */
  CLAUDE_WARNING_MS: 60_000,
  /** Polling de autenticação Claude após abrir browser (5 minutos) */
  CLAUDE_AUTH_POLL_MAX_MS: 300_000,
  /** Intervalo entre verificações de auth */
  CLAUDE_AUTH_POLL_INTERVAL_MS: 3_000,
  /** Delay inicial antes de começar polling de auth */
  CLAUDE_AUTH_POLL_DELAY_MS: 5_000,
  /** Timeout para comandos CLI curtos (which, version) */
  CLI_SHORT_MS: 5_000,
  /** Timeout para instalação de pacotes npm */
  NPM_INSTALL_MS: 120_000,
} as const;

export const FILE_LIMITS = {
  /** Tamanho máximo de arquivo para abrir no editor (10 MB) */
  MAX_READ_BYTES: 10 * 1024 * 1024,
  /** Debounce do file watcher (ms) */
  WATCHER_DEBOUNCE_MS: 300,
  /** Profundidade máxima de leitura recursiva de diretório */
  DIR_MAX_DEPTH: 3,
} as const;

import path from 'path';
import os from 'os';

/** Caminhos onde o Claude Code CLI pode estar instalado, em ordem de preferência */
export const CLAUDE_SEARCH_PATHS = [
  ...(process.env.CLAUDE_BIN_PATH ? [process.env.CLAUDE_BIN_PATH] : []),
  path.join(os.homedir(), '.local', 'bin', 'claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
  '/usr/bin/claude',
];

export const TERMINAL = {
  /** Linhas de buffer mantidas em memória por terminal */
  SCROLLBACK_LINES: 300,
  /** Debounce do ResizeObserver (ms) */
  RESIZE_DEBOUNCE_MS: 60,
  /** Delay antes de retry de criação do PTY (ms) */
  PTY_RETRY_DELAY_MS: 1_000,
} as const;
