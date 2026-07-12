import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRIDE Seating",
  description: "PRIDE Poker Club seating randomizer"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
