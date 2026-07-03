"use client";

import { useCallback, useState } from "react";

import Avatar from "../components/Avatar";
import ChatBox from "../components/ChatBox";
import VisualPanel from "../components/VisualPanel";
import VoiceInput from "../components/VoiceInput";

import { useAvatar } from "../hooks/useAvatar";
import { useSpeech } from "../hooks/useSpeech";
import {
  mapPanelToVisualPanelContent,
  sendChatMessage,
  toBackendLanguage,
} from "../services/api";

const LANGUAGES = [
  { code: "en", label: "EN", full: "English" },
  { code: "hi", label: "हि", full: "Hindi" },
  { code: "te", label: "తె", full: "Telugu" },
];

export default function Home() {
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [panelContent, setPanelContent] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Stable per-tab session id so the backend can (eventually) keep
  // conversational context across turns. Generated once on mount.
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const avatar = useAvatar();

  const speech = useSpeech({
    onTranscript: (transcript) => {
      avatar.setListening();
      handleAskTina(transcript);
    },
    onError: (error) => {
      console.error("Speech input error:", error);
      setErrorMessage(error.message);
      avatar.setIdle();
    },
  });

  const handleAskTina = useCallback(
    async (questionText) => {
      if (!questionText || !questionText.trim()) return;

      setErrorMessage(null);
      setIsThinking(true);
      avatar.setThinking();

      try {
        const result = await sendChatMessage({
          queryText: questionText,
          voiceLanguage: toBackendLanguage(activeLanguage),
          sessionId,
        });

        const { panel, audio_base64: audioBase64, audio_format: audioFormat } =
          result ?? {};

        setPanelContent(mapPanelToVisualPanelContent(panel));
        setIsThinking(false);

        if (audioBase64) {
          // Paid path: play the ElevenLabs-generated narration.
          avatar.setSpeaking();
          try {
            await speech.playAudio(audioBase64, audioFormat);
          } catch (playbackError) {
            // Narration audio is a nice-to-have, not core to the request —
            // a decode/playback failure shouldn't surface as a page error.
            console.warn("Narration playback failed:", playbackError);
          }
        } else if (panel?.ai_conversation_summary) {
          // Free fallback: the backend couldn't produce ElevenLabs audio
          // (e.g. free-tier voices aren't callable via their API), so
          // narrate with the browser's built-in speech synthesis instead —
          // no API key, no cost, works immediately.
          avatar.setSpeaking();
          try {
            await speech.speakText(panel.ai_conversation_summary, activeLanguage);
          } catch (speakError) {
            console.warn("Browser narration failed:", speakError);
          }
        }
      } catch (error) {
        console.error("ShikshaAI chat request failed:", error);
        setErrorMessage(
          error?.message || "Something went wrong. Please try again."
        );
        setIsThinking(false);
      } finally {
        avatar.setIdle();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLanguage, sessionId]
  );

  const handleToggleListening = useCallback(() => {
    if (!speech.isListening) {
      avatar.setListening();
    } else {
      avatar.setIdle();
    }
    speech.toggleListening(activeLanguage);
  }, [speech, avatar, activeLanguage]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {/* ---------------------------------- */}
      {/* Premium Top Navbar                  */}
      {/* ---------------------------------- */}
      <header className="z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 backdrop-blur-2xl sm:h-20 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-violet-500 to-accent-indigo-600 shadow-glow-violet sm:h-11 sm:w-11">
            <span className="font-display text-base font-bold text-white sm:text-lg">
              शि
            </span>
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-accent-emerald-400 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              Shiksha<span className="text-gradient-violet">AI</span>
            </span>
            <span className="hidden text-[11px] font-medium tracking-wide text-white/40 sm:block">
              Learn out loud, in your language
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setActiveLanguage(lang.code)}
                aria-pressed={activeLanguage === lang.code}
                className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ease-out-expo sm:px-4 sm:text-sm ${
                  activeLanguage === lang.code
                    ? "bg-gradient-to-r from-accent-violet-600 to-accent-indigo-600 text-white shadow-glow-violet"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md sm:flex">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent-emerald-400" />
            <span className="text-xs font-medium text-white/60">
              Tina is online
            </span>
          </div>
        </div>
      </header>

      {errorMessage && (
        <div className="mx-4 mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200 sm:mx-5">
          {errorMessage}
        </div>
      )}

      {/* ---------------------------------- */}
      {/* Split-Screen 12-Column Grid          */}
      {/* ---------------------------------- */}
      <main className="grid w-full flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-12 lg:gap-5 lg:p-5">
        {/* Left: Avatar Studio (5/12 on desktop) */}
        <section
          aria-label="Tina AI Tutor Avatar Studio"
          className="glass-panel relative flex min-h-[45vh] flex-col overflow-hidden lg:col-span-5 lg:min-h-0"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-violet-400" />
              <h2 className="font-display text-sm font-semibold tracking-wide text-white/80">
                Avatar Studio
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
              {LANGUAGES.find((l) => l.code === activeLanguage)?.full}
            </span>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-8">
            <Avatar
              state={avatar.state}
              volumeLevel={avatar.volumeLevel}
              languageLabel={LANGUAGES.find((l) => l.code === activeLanguage)?.full}
            />
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <VoiceInput
              isListening={speech.isListening}
              onToggleListening={handleToggleListening}
              language={activeLanguage}
              onLanguageChange={setActiveLanguage}
              volumeLevel={avatar.volumeLevel}
              disabled={isThinking}
            />
          </div>
        </section>

        {/* Right: Visual Knowledge Panel (7/12 on desktop) */}
        <section
          aria-label="Dynamic Visual Knowledge Panel"
          className="glass-panel relative flex min-h-[45vh] flex-col overflow-hidden lg:col-span-7 lg:min-h-0"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald-400" />
              <h2 className="font-display text-sm font-semibold tracking-wide text-white/80">
                Visual Knowledge Panel
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
              English
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <VisualPanel content={panelContent} isLoading={isThinking} />
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <ChatBox onSend={handleAskTina} isThinking={isThinking} />
          </div>
        </section>
      </main>
    </div>
  );
}