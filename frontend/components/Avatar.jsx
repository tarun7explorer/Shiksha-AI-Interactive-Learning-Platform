"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATE_COPY = {
  idle: { label: "Ready when you are", color: "text-white/40" },
  listening: { label: "Listening…", color: "text-accent-emerald-400" },
  thinking: { label: "Thinking…", color: "text-accent-indigo-300" },
  speaking: { label: "Speaking…", color: "text-accent-violet-300" },
};

const CORE_GRADIENTS = {
  idle: "from-accent-violet-500/40 via-accent-indigo-500/30 to-accent-emerald-400/20",
  listening: "from-accent-emerald-400/50 via-accent-emerald-500/30 to-accent-indigo-400/20",
  thinking: "from-accent-indigo-500/50 via-accent-violet-600/35 to-accent-violet-400/20",
  speaking: "from-accent-violet-400/55 via-accent-indigo-400/35 to-accent-emerald-400/25",
};

/**
 * Avatar
 * Renders Tina's living mesh-core visual. The same SVG/CSS core morphs
 * its motion profile per `state`: breathing (idle), pulsing (listening),
 * rotating (thinking), and rippling (speaking).
 *
 * Props:
 *  - state: 'idle' | 'listening' | 'thinking' | 'speaking'
 *  - volumeLevel: 0..1, drives ripple intensity while speaking/listening
 *  - languageLabel: small caption shown under the core (e.g. "English")
 */
export default function Avatar({
  state = "idle",
  volumeLevel = 0,
  languageLabel = "English",
}) {
  const safeState = STATE_COPY[state] ? state : "idle";
  const copy = STATE_COPY[safeState];
  const gradient = CORE_GRADIENTS[safeState];

  const rippleCount = useMemo(() => [0, 1, 2], []);
  const shardCount = useMemo(() => Array.from({ length: 6 }), []);

  const coreMotion = {
    idle: {
      scale: [1, 1.06, 1],
      rotate: 0,
      transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
    },
    listening: {
      scale: [1, 1.16, 1],
      rotate: 0,
      transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
    },
    thinking: {
      scale: 1,
      rotate: 360,
      transition: { duration: 3.2, repeat: Infinity, ease: "linear" },
    },
    speaking: {
      scale: [1, 1.04 + volumeLevel * 0.12, 1],
      rotate: 0,
      transition: { duration: 0.45, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Glassmorphic Studio Frame */}
      <div className="relative flex h-full w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 px-6 py-10 shadow-glass backdrop-blur-xl">
        {/* Ambient backdrop wash that recolors with state */}
        <motion.div
          key={`wash-${safeState}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} blur-3xl`}
        />

        {/* Orbiting shards — visible mainly during thinking/speaking */}
        <div className="absolute inset-0 flex items-center justify-center">
          {shardCount.map((_, i) => {
            const angle = (360 / shardCount.length) * i;
            return (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-white/30"
                style={{
                  transform: `rotate(${angle}deg) translateY(-92px)`,
                }}
                animate={{
                  opacity:
                    safeState === "thinking"
                      ? [0.2, 0.9, 0.2]
                      : safeState === "speaking"
                      ? [0.1, 0.6, 0.1]
                      : 0.12,
                  scale: safeState === "thinking" ? [1, 1.6, 1] : 1,
                }}
                transition={{
                  duration: safeState === "thinking" ? 1.6 : 2.4,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>

        {/* Ripple rings — active during listening + speaking */}
        <AnimatePresence>
          {(safeState === "listening" || safeState === "speaking") &&
            rippleCount.map((i) => (
              <motion.span
                key={`ripple-${safeState}-${i}`}
                initial={{ opacity: 0.45, scale: 0.6 }}
                animate={{ opacity: 0, scale: 1.9 + volumeLevel * 0.4 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: safeState === "listening" ? 2.2 : 1.4,
                  repeat: Infinity,
                  delay: i * (safeState === "listening" ? 0.55 : 0.32),
                  ease: "easeOut",
                }}
                className={`absolute h-40 w-40 rounded-full border ${
                  safeState === "listening"
                    ? "border-accent-emerald-400/50"
                    : "border-accent-violet-400/50"
                }`}
              />
            ))}
        </AnimatePresence>

        {/* The Core */}
        <motion.div
          animate={coreMotion[safeState]}
          className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full sm:h-44 sm:w-44"
        >
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} shadow-glow-violet`}
          />
          <div className="absolute inset-[6px] rounded-full border border-white/10 bg-slate-950/40 backdrop-blur-md" />

          {/* Inner mesh strands */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]"
          >
            <defs>
              <linearGradient id="meshStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ad96ff" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <motion.path
              d="M100,30 C140,30 170,60 170,100 C170,140 140,170 100,170 C60,170 30,140 30,100 C30,60 60,30 100,30 Z"
              fill="none"
              stroke="url(#meshStroke)"
              strokeWidth="1.5"
              strokeLinecap="round"
              animate={{
                pathLength:
                  safeState === "speaking" ? [0.6, 1, 0.6] : [0.85, 1, 0.85],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: safeState === "speaking" ? 0.9 : 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.circle
              cx="100"
              cy="100"
              r="48"
              fill="none"
              stroke="url(#meshStroke)"
              strokeWidth="1"
              strokeDasharray="4 6"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "100px 100px" }}
            />
          </svg>

          {/* Central glyph */}
          <motion.span
            animate={{
              opacity: safeState === "thinking" ? [0.7, 1, 0.7] : 1,
            }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="relative z-10 font-display text-3xl font-bold text-white drop-shadow-lg sm:text-4xl"
          >
            T
          </motion.span>
        </motion.div>

        {/* Waveform bars — only while speaking */}
        <div className="mt-6 flex h-6 items-end justify-center gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <motion.span
              key={i}
              className="w-1 rounded-full bg-accent-violet-400/80"
              animate={
                safeState === "speaking"
                  ? {
                      height: [
                        `${20 + Math.random() * 10}%`,
                        `${50 + volumeLevel * 50}%`,
                        `${20 + Math.random() * 10}%`,
                      ],
                    }
                  : safeState === "listening"
                  ? { height: ["20%", "45%", "20%"] }
                  : { height: "14%" }
              }
              transition={{
                duration: safeState === "speaking" ? 0.5 : 1.6,
                repeat: Infinity,
                delay: i * 0.05,
                ease: "easeInOut",
              }}
              style={{ height: "14%" }}
            />
          ))}
        </div>

        {/* Status caption */}
        <div className="mt-5 flex flex-col items-center gap-1">
          <AnimatePresence mode="wait">
            <motion.span
              key={safeState}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={`text-sm font-medium ${copy.color}`}
            >
              {copy.label}
            </motion.span>
          </AnimatePresence>
          <span className="text-[11px] uppercase tracking-wider text-white/25">
            {languageLabel}
          </span>
        </div>
      </div>
    </div>
  );
}