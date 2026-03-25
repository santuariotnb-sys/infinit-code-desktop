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

  const isSupported = Boolean(SpeechRecognition);

  function clearError() {
    setVoiceError(null);
  }

  async function handleVoiceToggle() {
    if (!SpeechRecognition) {
      setVoiceError('Web Speech API não disponível neste ambiente.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    setVoiceError(null);

    // Pede permissão de microfone ao sistema operacional (macOS: aciona diálogo nativo)
    try {
      const perm = await window.api.media?.requestMicrophone?.();
      if (perm && !perm.granted) {
        setVoiceError('Microfone bloqueado pelo sistema. Vá em Preferências do Sistema → Privacidade → Microfone e autorize o Infinit Code.');
        return;
      }
    } catch { /* ignora — prossegue para getUserMedia */ }

    // Testa acesso ao microfone via getUserMedia —
    // isso aciona o diálogo de permissão do Electron / macOS se ainda não foi concedido
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Para as tracks imediatamente — só precisávamos verificar acesso
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const msg = (err as DOMException).message ?? '';
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError') || (err as DOMException).name === 'NotAllowedError') {
        setVoiceError('Microfone bloqueado. Vá em Preferências do Sistema → Privacidade → Microfone e autorize o Infinit Code.');
      } else if ((err as DOMException).name === 'NotFoundError') {
        setVoiceError('Nenhum microfone encontrado. Verifique se há um dispositivo de áudio conectado.');
      } else {
        setVoiceError(`Erro ao acessar microfone: ${msg || (err as DOMException).name}`);
      }
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);

    rec.onerror = (e: { error: string }) => {
      setIsListening(false);
      switch (e.error) {
        case 'not-allowed':
          setVoiceError('Microfone bloqueado. Autorize em Preferências do Sistema → Privacidade → Microfone.');
          break;
        case 'service-not-allowed':
          // Web Speech API usa servidores do Google — muitas vezes bloqueada em apps Electron
          setVoiceError('Reconhecimento de voz indisponível neste app. Use ⌘⇧V para acionar a voz nativa do Claude.');
          break;
        case 'network':
          setVoiceError('Sem conexão com o serviço de reconhecimento de voz. Verifique a internet.');
          break;
        case 'no-speech':
          // Não é erro — apenas não detectou fala
          break;
        default:
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
    } catch (err) {
      setIsListening(false);
      setVoiceError(`Não foi possível iniciar o reconhecimento: ${(err as Error).message}`);
    }
  }

  // Parar reconhecimento ao desmontar — evita mic ativo em background
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
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
