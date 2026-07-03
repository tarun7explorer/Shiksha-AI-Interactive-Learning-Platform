"use client";

import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

/**
 * VisualPanel
 * Renders Tina's structured, English-only knowledge breakdown: a
 * headline summary, key-point cards, a related-media gallery, gold-
 * accented fact blocks, and an optional comparison matrix. Falls back
 * to a welcome card when no content has been generated yet.
 *
 * Expected `content` shape:
 * {
 *   title: string,
 *   summary: string,
 *   keyPoints: string[],
 *   images: { url: string, alt: string, credit?: string }[],
 *   facts: string[],
 *   comparison: { headers: string[], rows: string[][] } | null
 * }
 */
export default function VisualPanel({ content = null, isLoading = false }) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (!content) {
    return <WelcomeState />;
  }

  const { title, summary, keyPoints = [], images = [], facts = [], comparison } =
    content;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5"
    >
      {/* Title + Summary */}
      <motion.div
        variants={cardVariants}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-violet-500/20 blur-3xl" />
        <span className="mb-2 inline-block rounded-full border border-accent-violet-400/30 bg-accent-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-violet-300">
          Concept Breakdown
        </span>
        <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
          {summary}
        </p>
      </motion.div>

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <motion.div variants={cardVariants} className="glass-card p-6">
          <h4 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-indigo-400" />
            Key Points
          </h4>
          <ul className="flex flex-col gap-3">
            {keyPoints.map((point, idx) => (
              <motion.li
                key={idx}
                variants={cardVariants}
                className="flex items-start gap-3 text-sm leading-relaxed text-white/70"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-indigo-500/20 text-[10px] font-bold text-accent-indigo-300">
                  {idx + 1}
                </span>
                <span>{point}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Related Media Gallery */}
      {images.length > 0 && (
        <motion.div variants={cardVariants}>
          <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald-400" />
            Related Visuals
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, idx) => (
              <motion.figure
                key={idx}
                variants={cardVariants}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="aspect-square w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.alt || "Related educational visual"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-110"
                  />
                </div>
                {image.credit && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[9px] text-white/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {image.credit}
                  </figcaption>
                )}
              </motion.figure>
            ))}
          </div>
        </motion.div>
      )}

      {/* Fact Blocks — gold accented */}
      {facts.length > 0 && (
        <motion.div variants={cardVariants} className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Quick Facts
          </h4>
          {facts.map((fact, idx) => (
            <motion.div
              key={idx}
              variants={cardVariants}
              className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/[0.08] to-transparent px-5 py-4"
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-300 to-amber-500" />
              <p className="pl-2 text-sm leading-relaxed text-amber-50/90">
                {fact}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Comparison Matrix */}
      {comparison?.headers?.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="glass-card overflow-hidden"
        >
          <div className="border-b border-white/10 px-6 py-4">
            <h4 className="flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-violet-400" />
              Comparison
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.04]">
                  {comparison.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white/50"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row, rowIdx) => (
                  <motion.tr
                    key={rowIdx}
                    variants={cardVariants}
                    className="border-t border-white/[0.06] transition-colors duration-200 hover:bg-white/[0.03]"
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={`px-5 py-3.5 align-top text-white/70 ${
                          cellIdx === 0
                            ? "font-medium text-white/90"
                            : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function WelcomeState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-accent-violet-500/20 to-accent-emerald-400/10 shadow-glow-violet"
      >
        <span className="text-3xl">📘</span>
      </motion.div>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-white sm:text-xl">
          Your knowledge canvas is empty — for now
        </h3>
        <p className="max-w-sm text-sm leading-relaxed text-white/45">
          Ask Tina anything out loud or by typing below. Structured
          breakdowns, visuals, quick facts, and comparisons will appear
          here as she explains.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {["Explain photosynthesis", "Compare CPU vs GPU", "What is inflation?"].map(
          (suggestion) => (
            <span
              key={suggestion}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/50"
            >
              {suggestion}
            </span>
          )
        )}
      </div>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5">
      {[120, 88, 160].map((height, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: idx * 0.15,
            ease: "easeInOut",
          }}
          style={{ height }}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}