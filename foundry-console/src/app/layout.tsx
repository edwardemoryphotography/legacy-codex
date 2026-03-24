import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Foundry Console",
  description: "Case Study Zero — Workspace Console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
