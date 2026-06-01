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
      <body className="font-mono antialiased bg-[#0a0a0f]">
        {children}
      </body>
    </html>
  );
}
