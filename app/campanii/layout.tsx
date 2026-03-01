import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Campanii Civice | implicarecivica.ro",
  description:
    "Trimite emailuri către aleșii tăi locali. Platforma de campanii civice a implicarecivica.ro.",
  openGraph: {
    title: "Campanii Civice | implicarecivica.ro",
    description:
      "Trimite emailuri către aleșii tăi locali. Fă-ți vocea auzită.",
    type: "website",
  },
};

export default function CampaniiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/campanii" className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-activist-orange-500" />
            <span className="font-activist text-lg uppercase tracking-wider text-civic-blue-700 dark:text-civic-blue-400">
              Campanii Civice
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-civic-blue-500 dark:hover:text-civic-blue-400 transition-colors"
          >
            implicarecivica.ro
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Platforma de campanii civice a{" "}
            <Link
              href="/"
              className="text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
            >
              implicarecivica.ro
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
