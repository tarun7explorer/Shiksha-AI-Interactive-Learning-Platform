"use client";

/**
 * hooks/useSpeech.js
 *
 * Wraps browser audio concerns behind one hook so VoiceInput.jsx and
 * page.jsx stay declarative:
 *
 *  1. Speech-to-text: the browser's native SpeechRecognition API,
 *     used to capture the student's spoken question.
 *  2. Text-to-speech playback (paid path): plays the base64 MP3 the
 *     backend returns (synthesized by ElevenLabs in speech_service.py),
 *     when available.
 *  3. Text-to-speech (FREE fallback): the browser's native
 *     SpeechSynthesis API. Used automatically when the backend
 *     couldn't produce ElevenLabs audio — e.g. ElevenLabs' free tier
 *     no longer allows calling Voice Library voices via the API
 *     (a 402 "Free users cannot use library voices via the API"
 *     response). This fallback needs no API key, has no character
 *     limit, and works entirely client-side.
 */

import { useCallback, useRef, useState } from "react";

const LANGUAGE_TO_BCP47 = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
};

export function useSpeech({ onTranscript, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  const startListening = useCallback(
    (uiLanguageCode = "en") => {
      const SpeechRecognitionImpl =
        typeof window !== "undefined" &&
        (window.SpeechRecognition || window.webkitSpeechRecognition);

      if (!SpeechRecognitionImpl) {
        onError?.(
          new Error(
            "Speech recognition isn't supported in this browser. Try typing your question instead."
          )
        );
        return;
      }

      const recognition = new SpeechRecognitionImpl();
      recognition.lang = LANGUAGE_TO_BCP47[uiLanguageCode] || "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        if (transcript.trim()) {
          onTranscript?.(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        onError?.(new Error(`Speech recognition error: ${event.error}`));
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    },
    [onTranscript, onError]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(
    (uiLanguageCode) => {
      if (isListening) {
        stopListening();
      } else {
        startListening(uiLanguageCode);
      }
    },
    [isListening, startListening, stopListening]
  );

  /** Plays a base64-encoded audio clip and resolves when playback ends. */
  const playAudio = useCallback((audioBase64, audioFormat = "audio/mpeg") => {
    return new Promise((resolve, reject) => {
      if (!audioBase64) {
        resolve();
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(`data:${audioFormat};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = (event) => reject(event);
      audio.play().catch(reject);
    });
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  /**
   * FREE fallback narration using the browser's built-in SpeechSynthesis
   * API — no API key, no character limits, no backend involved. Resolves
   * when speech finishes (or immediately if the browser doesn't support
   * it, so the UI is never blocked).
   */
  const speakText = useCallback((text, uiLanguageCode = "en") => {
    return new Promise((resolve) => {
      const synth = typeof window !== "undefined" && window.speechSynthesis;
      if (!synth || !text || !text.trim()) {
        resolve();
        return;
      }

      synth.cancel(); // stop anything currently queued/speaking

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGE_TO_BCP47[uiLanguageCode] || "en-IN";
      utterance.rate = 1;
      utterance.pitch = 1;

      // Prefer a voice matching the requested language if the browser has
      // one installed; otherwise fall back to whatever default voice is
      // available (an English voice almost always is).
      const pickVoice = () => {
        const voices = synth.getVoices();
        const exactMatch = voices.find((v) => v.lang === utterance.lang);
        const looseMatch =
          exactMatch ||
          voices.find((v) => v.lang?.startsWith(utterance.lang.split("-")[0]));
        if (looseMatch) utterance.voice = looseMatch;
      };

      if (synth.getVoices().length > 0) {
        pickVoice();
      } else {
        // Some browsers (notably Chrome) load voices asynchronously.
        synth.onvoiceschanged = pickVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // never block the UI on a TTS glitch

      synth.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
    playAudio,
    stopAudio,
    speakText,
    stopSpeaking,
  };
}