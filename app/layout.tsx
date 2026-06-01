import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filings Outreach CRM | AntiGravity",
  description: "Automated daily filings outreach system — EDGAR signal matching, personalized email, CRM tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-mono antialiased bg-[#0a0a0f] text-zinc-100 flex flex-col min-h-screen">
        {/* Global Branded Header */}
        <header className="border-b border-zinc-800 bg-[#0d0d14] px-8 py-5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                FILINGS OUTREACH <span className="text-violet-400">CRM</span>
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">AntiGravity / Automated Outreach System</p>
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
