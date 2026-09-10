import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Relief",
  description: "Internal 3D visual editor for brand design: 3D text, shapes, materials and high-resolution export.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-950 text-neutral-200">{children}</body>
    </html>
  );
}
