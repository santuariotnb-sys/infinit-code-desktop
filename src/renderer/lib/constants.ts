// Constantes globais do renderer
export const TERMINAL = {
  /** Linhas de buffer mantidas em memória por terminal */
  SCROLLBACK_LINES: 300,
  /** Debounce do ResizeObserver (ms) */
  RESIZE_DEBOUNCE_MS: 60,
  /** Delay antes de retry de criação do PTY (ms) */
  PTY_RETRY_DELAY_MS: 1_000,
} as const;

export const FILE_MANAGER = {
  /** Delay do auto-save após parar de digitar (ms) */
  AUTOSAVE_DEBOUNCE_MS: 1_500,
} as const;
