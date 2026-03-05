import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Gerenciador WhatsApp",
  description: "Gerencie suas conversas do WhatsApp com facilidade",
};

import AuthGuard from "@/components/AuthGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-zinc-50 text-zinc-900`}>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
