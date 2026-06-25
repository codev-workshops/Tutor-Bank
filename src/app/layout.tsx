import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tutor Bank",
  description: "Find and book tutors for any subject",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">
            Tutor Bank
          </Link>
          <div className="flex gap-4">
            <Link href="/tutors" className="hover:text-blue-600 transition">
              Browse Tutors
            </Link>
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              Dashboard
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
