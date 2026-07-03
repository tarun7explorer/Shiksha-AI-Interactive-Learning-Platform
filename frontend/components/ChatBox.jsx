"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_TEXTAREA_HEIGHT = 160;

/**
 * ChatBox
 * The text-based conversational tray that sits beneath the Visual
 * Knowledge Panel. The textarea auto-grows and its border glows on
 * focus; submitting clears the field and bubbles the question up.
 *
 * Props:
 *  - onSend: (message: string) => void
 *  - isThinking: boolean — disables input + shows a typing affordance
 *  - placeholder: string
 */
export default function ChatBox({
  onSend = () => {},
  isThinking = false,
  placeholder = "Type a follow-up question…",
}) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  const resizeTextarea = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isThinking) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(resizeTextarea);
  }, [value, isThinking, onSend, resizeTextarea]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const charCount = value.length;
  const isNearLimit = charCount > 400;

  return (
    <div className="flex w-full flex-col gap-2">
      <motion.div
        animate={{
          boxShadow: isFocused
            ? "0 0 0 1.5px rgba(124,77,255,0.6), 0 0 32px -6px rgba(124,77,255,0.45)"
            : "0 0 0 1px rgba(255,255,255,0.1), 0 0 0px rgba(124,77,255,0)",
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-md"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={isThinking}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={500}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/30 focus:outline-none disabled:opacity-40"
        />

        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          <AnimatePresence>
            {isNearLimit && (
              <motion.span
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-medium text-amber-400/80"
              >
                {500 - charCount} left
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || isThinking}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent-violet-600 to-accent-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-glow-violet transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
          >
            <span>Send</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12h16M14 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 px-1"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                  className="h-1.5 w-1.5 rounded-full bg-accent-violet-400"
                />
              ))}
            </span>
            <span className="text-xs text-white/40">
              Tina is composing a response…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}