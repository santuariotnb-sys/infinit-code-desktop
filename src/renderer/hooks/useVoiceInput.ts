import { useState, useRef, useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognition = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
}

export function useVoiceInput({ onTranscript }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Analyser — alimentado pelo stream ativo
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);

  const isSupported = Boolean(navigator.mediaDevices?.getUserMedia);

  function clearError() { setVoiceError(null); }

  // Liga analyser ao stream já aberto (sem abrir novo getUserMedia)
  function attachAnalyser(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch { /* silencia — waveform fica sintético */ }
  }

  function stopAll() {
    // Para Web Speech
    try { recognitionRef.current?.stop(); } catch { /**/ }
    recognitionRef.current = null;
    // Para MediaRecorder (dispara onstop que transcreve)
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch { /**/ }
    // Para stream de áudio
    try { activeStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /**/ }
    activeStreamRef.current = null;
    // Para AudioContext
    try { audioCtxRef.current?.close(); } catch { /**/ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  // Transcreve via Groq Whisper (fallback quando Web Speech não funciona)
  async function transcribeWithGroq(blob: Blob) {
    setVoiceError('Transcrevendo...');
    try {
      const buf = await blob.arrayBuffer();
      const result = await window.api.aiProvider?.transcribe?.(buf, 'pt');
      if (result?.ok && result.text) {
        setVoiceError(null);
        onTranscript(result.text.trim());
      } else {
        setVoiceError(result?.error ?? 'Transcrição falhou. Configure a Groq API Key em Configurações → AI Providers.');
      }
    } catch (e) {
      setVoiceError(`Erro na transcrição: ${(e as Error).message}`);
    }
  }

  // Inicia gravação dado um stream já autorizado
  async function startRecognitionWithStream(stream: MediaStream) {
    activeStreamRef.current = stream;

    // 1. Liga analyser ao stream imediatamente → waveform ativo na hora
    attachAnalyser(stream);

    // 2. Inicia MediaRecorder no mesmo stream como backup
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

    chunksRef.current = [];
    let webSpeechSucceeded = false;

    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      setIsListening(false);
      stopAll();
      if (webSpeechSucceeded) return; // Web Speech já entregou transcript
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await transcribeWithGroq(blob);
    };
    mr.start(250); // coleta chunks a cada 250ms

    // 3. Mostra waveform imediatamente (não espera onstart do Web Speech)
    setIsListening(true);

    // 4. Tenta Web Speech API em paralelo (mais rápido, sem API key)
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onresult = (event: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
        webSpeechSucceeded = true;
        const text = event.results[0][0].transcript;
        // Para o MediaRecorder sem transcrever (Web Speech venceu)
        try { mr.stop(); } catch { /**/ }
        onTranscript(text);
      };

      rec.onerror = (e: { error: string }) => {
        // service-not-allowed ou network → MediaRecorder continua gravando
        // onend do MediaRecorder vai transcrever via Groq
        if (e.error === 'not-allowed') {
          setNeedsPermission(true);
          try { mr.stop(); } catch { /**/ }
        }
        // para outros erros (service-not-allowed, network) → deixa MediaRecorder continuar
      };

      rec.onend = () => {
        // Se Web Speech terminou sem resultado e MediaRecorder ainda grava → para ele
        if (!webSpeechSucceeded && mr.state === 'recording') {
          try { mr.stop(); } catch { /**/ }
        }
      };

      recognitionRef.current = rec;
      try { rec.start(); } catch { /* falha silenciosa — MediaRecorder continua */ }
    }
    // Se não há SpeechRecognition, MediaRecorder grava tudo e Groq transcreve ao parar
  }

  async function handleVoiceToggle() {
    if (isListening) {
      // Para tudo — onstop do MediaRecorder vai transcrever
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        setIsListening(false);
        stopAll();
      }
      return;
    }

    setVoiceError(null);
    setNeedsPermission(false);

    // Solicita permissão ao macOS (aciona diálogo nativo se necessário)
    try {
      const perm = await window.api.media?.requestMicrophone?.();
      if (perm && !perm.granted) { setNeedsPermission(true); return; }
    } catch { /* tenta getUserMedia mesmo assim */ }

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

  // Chamado pelo MicPermissionModal quando macOS concedeu acesso
  async function onPermissionGranted(stream: MediaStream) {
    setNeedsPermission(false);
    await startRecognitionWithStream(stream);
  }

  useEffect(() => {
    return () => { stopAll(); };
  }, []);

  return {
    isListening,
    isSupported,
    voiceError,
    clearError,
    needsPermission,
    dismissPermission: () => setNeedsPermission(false),
    onPermissionGranted,
    handleVoiceToggle,
    analyserRef,
  };
}
