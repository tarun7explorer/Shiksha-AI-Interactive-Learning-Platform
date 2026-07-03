/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05050a",
          900: "#0a0a14",
          850: "#0e0e1a",
          800: "#13131f",
          700: "#1b1b2b",
          600: "#262638",
          500: "#33334a",
        },
        slate: {
          950: "#070710",
          900: "#0c0c18",
          850: "#11111f",
          800: "#171728",
          700: "#202036",
          600: "#2c2c47",
        },
        accent: {
          violet: {
            50: "#f4f1ff",
            100: "#e9e3ff",
            200: "#cdbfff",
            300: "#ad96ff",
            400: "#8b6bff",
            500: "#7c4dff",
            600: "#6c2bff",
            700: "#5a1de6",
            800: "#4716b3",
            900: "#341080",
          },
          indigo: {
            300: "#a5b4fc",
            400: "#818cf8",
            500: "#6366f1",
            600: "#4f46e5",
            700: "#4338ca",
          },
          emerald: {
            300: "#6ee7b7",
            400: "#34d399",
            500: "#10b981",
            600: "#059669",
            700: "#047857",
          },
        },
        glass: {
          light: "rgba(255, 255, 255, 0.06)",
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          dark: "rgba(10, 10, 20, 0.55)",
          border: "rgba(255, 255, 255, 0.12)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "ui-sans-serif", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
        "4xl": "72px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-inset": "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
        "glow-violet": "0 0 40px -10px rgba(124, 77, 255, 0.55)",
        "glow-emerald": "0 0 40px -10px rgba(16, 185, 129, 0.45)",
        "glow-indigo": "0 0 40px -10px rgba(99, 102, 241, 0.5)",
        "soft-xl": "0 20px 60px -15px rgba(0, 0, 0, 0.5)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(circle at 50% 0%, rgba(124, 77, 255, 0.18), transparent 60%)",
        "mesh-violet-emerald":
          "radial-gradient(at 20% 20%, rgba(124,77,255,0.25) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(16,185,129,0.2) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(99,102,241,0.2) 0px, transparent 50%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: 0.55, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.08)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        waveform: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(124, 77, 255, 0.4)" },
          "50%": { borderColor: "rgba(16, 185, 129, 0.4)" },
        },
        spinSlow: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        float: "floatY 4s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        waveform: "waveform 1.2s ease-in-out infinite",
        "border-glow": "borderGlow 4s ease-in-out infinite",
        "spin-slow": "spinSlow 8s linear infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-smooth": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
  plugins: [],
};