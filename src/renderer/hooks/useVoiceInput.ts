import { useState, useRef, useEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognition = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
}

export function useVoiceInput({ onTranscript }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Áudio analyser para visualização de frequência
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vizStreamRef = useRef<MediaStream | null>(null);

  const isSupported = Boolean(SpeechRecognition) || Boolean(navigator.mediaDevices?.getUserMedia);

  function clearError() {
    setVoiceError(null);
  }

  // Inicia captura de frequência via Web Audio API para visualização
  const startAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      vizStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      // Sem visualização se não conseguir — não bloqueia o reconhecimento
    }
  }, []);

  function stopAnalyser() {
    try {
      vizStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    } catch { /* ignora */ }
    analyserRef.current = null;
    audioCtxRef.current = null;
    vizStreamRef.current = null;
  }

  // Fallback: grava com MediaRecorder e transcreve via Groq Whisper
  async function startWhisperFallback(stream: MediaStream) {
    await startAnalyser();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      stopAnalyser();
      setIsListening(false);

      if (chunksRef.current.length === 0) return;

      const blob = new Blob(chunksRef.current, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();

      setVoiceError('Transcrevendo...');
      try {
        const result = await window.api.aiProvider?.transcribe?.(arrayBuffer, 'pt');
        if (result?.ok && result.text) {
          setVoiceError(null);
          onTranscript(result.text.trim());
        } else {
          setVoiceError(result?.error ?? 'Transcrição falhou. Configure a Groq API Key nas configurações.');
        }
      } catch (e) {
        setVoiceError(`Erro na transcrição: ${(e as Error).message}`);
      }
    };

    mr.start();
    setIsListening(true);
  }

  async function handleVoiceToggle() {
    // Parar se já está gravando
    if (isListening) {
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      stopAnalyser();
      return;
    }

    setVoiceError(null);

    // Solicita permissão ao macOS na primeira vez (aciona diálogo nativo)
    try {
      const perm = await window.api.media?.requestMicrophone?.();
      if (perm && !perm.granted) {
        setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
        return;
      }
    } catch { /* tenta getUserMedia mesmo assim */ }

    // Verifica acesso ao microfone — também garante que o diálogo aparece no Electron
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
      } else if (name === 'NotFoundError') {
        setVoiceError('Nenhum microfone encontrado. Verifique se há um dispositivo de áudio conectado.');
      } else {
        setVoiceError(`Erro ao acessar microfone: ${name}`);
      }
      return;
    }

    // Tenta Web Speech API (sem API key, mais rápido)
    if (SpeechRecognition) {
      stream.getTracks().forEach((t) => t.stop()); // SpeechRecognition abre a própria stream
      await startAnalyser(); // stream separada só para visualização

      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onstart = () => setIsListening(true);
      rec.onend = () => {
        setIsListening(false);
        stopAnalyser();
      };

      rec.onerror = async (e: { error: string }) => {
        stopAnalyser();
        setIsListening(false);
        if (e.error === 'service-not-allowed' || e.error === 'network') {
          // Web Speech bloqueada → fallback Groq Whisper
          setVoiceError(null);
          try {
            const s2 = await navigator.mediaDevices.getUserMedia({ audio: true });
            await startWhisperFallback(s2);
          } catch {
            setVoiceError('Não foi possível iniciar gravação. Verifique o microfone.');
          }
        } else if (e.error === 'not-allowed') {
          setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
        } else if (e.error !== 'no-speech') {
          setVoiceError(`Erro de reconhecimento: ${e.error}`);
        }
      };

      rec.onresult = (event: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
        onTranscript(event.results[0][0].transcript);
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        stopAnalyser();
        setIsListening(false);
        try {
          const s2 = await navigator.mediaDevices.getUserMedia({ audio: true });
          await startWhisperFallback(s2);
        } catch {
          setVoiceError('Não foi possível iniciar gravação.');
        }
      }
    } else {
      // Sem Web Speech API → Groq Whisper direto
      await startWhisperFallback(stream);
    }
  }

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      stopAnalyser();
    };
  }, []);

  return {
    isListening,
    isSupported,
    voiceError,
    clearError,
    handleVoiceToggle,
    analyserRef, // exposto para componente de visualização
  };
}
