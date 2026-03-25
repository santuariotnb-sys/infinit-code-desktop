import { useState, useRef, useEffect } from 'react';

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

  const isSupported = Boolean(SpeechRecognition) || Boolean(navigator.mediaDevices?.getUserMedia);

  function clearError() {
    setVoiceError(null);
  }

  // Fallback: grava áudio via MediaRecorder e transcreve com Groq Whisper
  async function startWhisperFallback(stream: MediaStream) {
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
      return;
    }

    setVoiceError(null);

    // Solicita permissão ao macOS (aciona diálogo nativo se necessário)
    try {
      const perm = await window.api.media?.requestMicrophone?.();
      if (perm && !perm.granted) {
        setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
        return;
      }
    } catch { /* ignora — tenta getUserMedia mesmo assim */ }

    // Verifica acesso ao microfone via getUserMedia
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

    // Tenta Web Speech API primeiro (não precisa de API key, mais rápido)
    if (SpeechRecognition) {
      stream.getTracks().forEach((t) => t.stop()); // libera stream — SpeechRecognition abre a própria

      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);

      rec.onerror = async (e: { error: string }) => {
        setIsListening(false);
        if (e.error === 'service-not-allowed' || e.error === 'network') {
          // Web Speech API bloqueada — usa fallback Groq Whisper
          setVoiceError(null);
          try {
            const s2 = await navigator.mediaDevices.getUserMedia({ audio: true });
            await startWhisperFallback(s2);
          } catch {
            setVoiceError('Não foi possível iniciar gravação. Verifique o microfone.');
          }
        } else if (e.error === 'not-allowed') {
          setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
        } else if (e.error === 'no-speech') {
          // Não é erro
        } else {
          setVoiceError(`Erro de reconhecimento: ${e.error}`);
        }
      };

      rec.onresult = (event: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        // Web Speech falhou ao iniciar — vai direto para Whisper
        setIsListening(false);
        try {
          const s2 = await navigator.mediaDevices.getUserMedia({ audio: true });
          await startWhisperFallback(s2);
        } catch {
          setVoiceError('Não foi possível iniciar gravação. Verifique o microfone.');
        }
      }
    } else {
      // Sem Web Speech API — usa Groq Whisper diretamente
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
    };
  }, []);

  return {
    isListening,
    isSupported,
    voiceError,
    clearError,
    handleVoiceToggle,
  };
}
