"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LANGUAGES = [
  { code: "en", label: "English", native: "EN" },
  { code: "hi", label: "Hindi", native: "हि" },
  { code: "te", label: "Telugu", native: "తె" },
];

/**
 * VoiceInput
 * The floating mic control for Tina's avatar studio. Shows recursive
 * pulsing rings while recording and exposes an animated language
 * toggle menu used to switch the active speech-recognition locale.
 *
 * Props:
 *  - isListening: boolean
 *  - onToggleListening: () => void
 *  - language: current language code ('en' | 'hi' | 'te')
 *  - onLanguageChange: (code: string) => void
 *  - volumeLevel: 0..1, intensifies the ring animation while live
 *  - disabled: boolean
 */
export default function VoiceInput({
  isListening = false,
  onToggleListening = () => {},
  language = "en",
  onLanguageChange = () => {},
  volumeLevel = 0,
  disabled = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeLanguage =
    LANGUAGES.find((lang) => lang.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      {/* Language Toggle Menu */}
      <div className="relative" ref={menuRef}>
        <motion.button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          whileTap={{ scale: 0.94 }}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-white/70 backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.08]"
        >
          <span className="font-display text-sm">{activeLanguage.native}</span>
          <motion.svg
            animate={{ rotate: menuOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-full left-0 mb-2 w-40 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-soft-xl backdrop-blur-2xl"
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onLanguageChange(lang.code);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    lang.code === language
                      ? "bg-gradient-to-r from-accent-violet-600/40 to-accent-indigo-600/30 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white/90"
                  }`}
                >
                  <span>{lang.label}</span>
                  <span className="text-xs text-white/40">{lang.native}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Mic Button */}
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence>
          {isListening &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{
                  opacity: 0,
                  scale: 1.8 + volumeLevel * 0.6,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "easeOut",
                }}
                className="absolute h-14 w-14 rounded-full border-2 border-rose-400/50"
              />
            ))}
        </AnimatePresence>

        <motion.button
          type="button"
          disabled={disabled}
          onClick={onToggleListening}
          whileTap={{ scale: 0.92 }}
          animate={
            isListening
              ? { scale: [1, 1.06 + volumeLevel * 0.1, 1] }
              : { scale: 1 }
          }
          transition={
            isListening
              ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
          className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
            isListening
              ? "border-rose-400/60 bg-gradient-to-br from-rose-500 to-rose-600 shadow-[0_0_30px_-6px_rgba(244,63,94,0.7)]"
              : "border-white/10 bg-gradient-to-br from-accent-violet-600 to-accent-indigo-600 shadow-glow-violet"
          }`}
          aria-pressed={isListening}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isListening ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="5" y="5" width="10" height="10" rx="2" fill="white" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
                fill="white"
              />
              <path
                d="M19 11a7 7 0 01-14 0M12 18v3"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Status pip */}
      <div className="flex w-16 items-center justify-end">
        <motion.span
          animate={{ opacity: isListening ? [0.4, 1, 0.4] : 0.3 }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className={`h-2 w-2 rounded-full ${
            isListening ? "bg-rose-400" : "bg-white/30"
          }`}
        />
      </div>
    </div>
  );
}