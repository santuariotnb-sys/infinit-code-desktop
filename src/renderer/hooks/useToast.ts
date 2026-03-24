import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);

  const showToast = useCallback((msg: string, durationMs = 2000) => {
    const id = Date.now();
    setToast({ msg, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), durationMs);
  }, []);

  return { toast, showToast };
}
