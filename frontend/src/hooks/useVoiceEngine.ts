import { useCallback, useRef } from 'react';


interface UseVoiceEngineReturn {
  speak: (message: string, cooldownMs?: number) => void;
  speakPriority: (message: string) => void;
  speakChecks: (checks: Record<string, [boolean, number | string, string]>, cooldownMs?: number) => void;
  isSpeaking: () => boolean;
}

/**
 * Enhanced voice engine for posture coaching.
 *
 * Three modes:
 *  speak()         — Normal coaching cue with a global cooldown.
 *  speakPriority() — Pre-empts any ongoing speech (rep counts, countdowns).
 *  speakChecks()   — Rotates through ALL failing check cues so the user
 *                    hears specific per-joint corrections in sequence rather
 *                    than a single generic primary cue.
 *
 * Timing:
 *  - cycleInterval: minimum gap before ANY check cue fires (prevents flooding)
 *  - checkCooldown: per-check cooldown — same instruction won't repeat for 6 s
 */
export function useVoiceEngine(): UseVoiceEngineReturn {
  const lastSpokenAt       = useRef<number>(0);
  const utteranceRef       = useRef<SpeechSynthesisUtterance | null>(null);
  const checkCooldownMap   = useRef<Record<string, number>>({});  // check_name -> last_spoken_ms
  const lastCycleAt        = useRef<number>(0);

  const CYCLE_INTERVAL_MS  = 3000;   // min gap between any two check cues
  const CHECK_COOLDOWN_MS  = 6000;   // per-check: don't repeat same correction for 6 s

  const _rawSpeak = useCallback((message: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate   = 0.92;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * Speak a normal coaching cue with a global cooldown.
   * cooldownMs defaults to 4 s so the same message isn't repeated too fast.
   */
  const speak = useCallback((message: string, cooldownMs = 4000) => {
    const now = Date.now();
    if (now - lastSpokenAt.current < cooldownMs) return;
    lastSpokenAt.current = now;
    _rawSpeak(message);
  }, [_rawSpeak]);

  /**
   * High-priority speech — pre-empts current speech immediately.
   * Used for rep-completion announcements and countdowns.
   */
  const speakPriority = useCallback((message: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate   = 0.95;
    utterance.pitch  = 1.1;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
    lastSpokenAt.current = Date.now();  // reset global cooldown too
  }, []);

  /**
   * Rotate through ALL failing checks and speak the next due correction.
   *
   * checks format (from Python WebSocket):
   *   { "spine_level": [false, 14.2, "Keep your back flat — don't let it sag."],
   *     "hip_level":   [true,   0.02, "Keep your hips level — don't rotate."],
   *     ... }
   *
   * Only ONE cue fires per call. The check whose cue is most overdue wins.
   * Returns immediately if the cycle gap hasn't elapsed yet.
   */
  const speakChecks = useCallback(
    (checks: Record<string, [boolean, number | string, string]>, _cooldownMs = CHECK_COOLDOWN_MS) => {
      const now = Date.now();

      // Enforce minimum gap between any two check cues
      if (now - lastCycleAt.current < CYCLE_INTERVAL_MS) return;

      // Collect failing checks with a usable cue string
      const failing = Object.entries(checks)
        .filter(([, [passed, , cue]]) => !passed && cue && cue.trim().length > 0)
        .map(([name, [, , cue]]): [string, string] => [name, cue]);

      if (failing.length === 0) return;

      // Pick the check whose cue is most overdue
      const [bestName, bestCue] = failing.reduce((best, current) => {
        const bestAge   = now - (checkCooldownMap.current[best[0]]   ?? 0);
        const currentAge = now - (checkCooldownMap.current[current[0]] ?? 0);
        return currentAge > bestAge ? current : best;
      });

      // Only speak if this check's own cooldown has expired
      const lastSpokenForCheck = checkCooldownMap.current[bestName] ?? 0;
      if (now - lastSpokenForCheck < CHECK_COOLDOWN_MS) return;

      _rawSpeak(bestCue);
      checkCooldownMap.current[bestName] = now;
      lastCycleAt.current = now;
      lastSpokenAt.current = now;
    },
    [_rawSpeak]
  );

  const isSpeaking = useCallback(() => {
    return window.speechSynthesis?.speaking ?? false;
  }, []);

  return { speak, speakPriority, speakChecks, isSpeaking };
}
