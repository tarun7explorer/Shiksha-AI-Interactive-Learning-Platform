"use client";

/**
 * hooks/useAvatar.js
 *
 * Encapsulates Tina's visual state machine so page.jsx never has to
 * juggle raw strings. Avatar.jsx already knows how to render each of
 * these four states — it was just never being fed them.
 */

import { useCallback, useState } from "react";

const STATES = Object.freeze({
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
});

export function useAvatar() {
  const [state, setState] = useState(STATES.IDLE);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const setIdle = useCallback(() => {
    setState(STATES.IDLE);
    setVolumeLevel(0);
  }, []);

  const setListening = useCallback(() => setState(STATES.LISTENING), []);
  const setThinking = useCallback(() => setState(STATES.THINKING), []);
  const setSpeaking = useCallback(() => setState(STATES.SPEAKING), []);

  return {
    state,
    volumeLevel,
    setVolumeLevel,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
    STATES,
  };
}