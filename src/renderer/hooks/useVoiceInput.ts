import { useState, useRef, useEffect } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
}

export function useVoiceInput({ onTranscript }: UseVoiceInputOptions) {
  const [isListening, setIsListening]         = useState(false);
  const [voiceError, setVoiceError]           = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const isMountedRef  = useRef(true);   // false após desmontagem — evita setState em componente morto
  const isStoppingRef = useRef(false);  // guard contra duplo stopAll()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const activeStreamRef  = useRef<MediaStream | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);

  const isSupported = Boolean(
    typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
  );

  function clearError()        { setVoiceError(null); }

  function attachAnalyser(stream: MediaStream) {
    try {
      const ctx      = new AudioContext();
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch { /* waveform fica sintético */ }
  }

  // Guard: executa uma única vez por sessão de gravação
  function stopAll() {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch { /**/ }

    try { activeStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /**/ }
    activeStreamRef.current = null;

    try { audioCtxRef.current?.close(); } catch { /**/ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function transcribeWithGroq(blob: Blob) {
    // Não atualiza estado se componente já foi desmontado
    if (!isMountedRef.current) return;
    setVoiceError('Transcrevendo...');

    try {
      const buf    = await blob.arrayBuffer();
      const result = await window.api.aiProvider?.transcribe?.(buf, 'pt');

      if (!isMountedRef.current) return;

      if (result?.ok && result.text) {
        setVoiceError(null);
        onTranscript(result.text.trim());
      } else {
        setVoiceError(result?.error ?? 'Transcrição falhou.');
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      setVoiceError(`Erro na transcrição: ${(e as Error).message}`);
    }
  }

  async function startRecognitionWithStream(stream: MediaStream) {
    // Reseta o guard para a nova sessão de gravação
    isStoppingRef.current = false;

    activeStreamRef.current = stream;
    attachAnalyser(stream);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      // stopAll() já pode ter sido chamado externamente — o guard impede re-execução
      stopAll();
      if (!isMountedRef.current) return;
      setIsListening(false);
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await transcribeWithGroq(blob);
    };

    mr.start(250);
    setIsListening(true);
  }

  async function handleVoiceToggle() {
    // ── Parar gravação ──────────────────────────────────────────
    if (isListening) {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop(); // dispara onstop → transcreve
      } else {
        setIsListening(false);
        stopAll();
      }
      return;
    }

    setVoiceError(null);
    setNeedsPermission(false);

    // ── Verifica bloqueio permanente de microfone no macOS ──────
    try {
      const perm = await window.api.media?.requestMicrophone?.();
      if (perm?.status === 'denied') {
        setNeedsPermission(true);
        return;
      }
    } catch { /**/ }

    // ── Obtém stream — dispara dialog nativo do macOS se necessário
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setNeedsPermission(true);
      } else if (name === 'NotFoundError') {
        setVoiceError('Nenhum microfone encontrado.');
      } else {
        setVoiceError(`Erro ao acessar microfone: ${name}`);
      }
      return;
    }

    await startRecognitionWithStream(stream);
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAll();
    };
  }, []);

  return {
    isListening,
    isSupported,
    voiceError,
    clearError,
    needsPermission,
    dismissPermission: () => setNeedsPermission(false),
    handleVoiceToggle,
    analyserRef,
  };
}
