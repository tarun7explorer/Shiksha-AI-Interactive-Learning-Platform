import "./globals.css";

export const metadata = {
  title: "ShikshaAI | Your AI Learning Companion",
  description:
    "ShikshaAI is an India-focused, multilingual AI tutor that explains, visualizes, and speaks alongside you — in English, Hindi, and Telugu.",
  keywords: [
    "ShikshaAI",
    "AI tutor",
    "multilingual learning",
    "India education",
    "AI avatar",
  ],
  authors: [{ name: "ShikshaAI" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05050a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="relative h-full min-h-screen w-full bg-slate-950 font-sans text-white antialiased">
        <div className="ambient-bg" aria-hidden="true" />
        <div
          className="ambient-orb-indigo"
          style={{ top: "30%", left: "50%", transform: "translateX(-50%)" }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex min-h-screen w-full flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}