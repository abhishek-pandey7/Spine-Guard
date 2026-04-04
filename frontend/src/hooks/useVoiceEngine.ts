import { useCallback, useRef, useState } from 'react';

interface UseVoiceEngineReturn {
  speak: (message: string, cooldownMs?: number) => void;
  isSpeaking: boolean;
}

export function useVoiceEngine(): UseVoiceEngineReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenAt = useRef<number>(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((message: string, cooldownMs = 4000) => {
    const now = Date.now();
    if (now - lastSpokenAt.current < cooldownMs) return;
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    lastSpokenAt.current = now;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, isSpeaking };
}
