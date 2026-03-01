import type { Metadata } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="min-h-screen flex flex-col">
        <header className="border-b-2 border-black bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="font-activist text-xl uppercase tracking-wider text-civic-blue-700">
                Campanii Civice
              </span>
            </a>
            <a
              href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://implicarecivica.ro"}
              className="text-sm text-urban-gray-500 hover:text-civic-blue-500 transition-colors"
            >
              implicarecivica.ro
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t-2 border-black bg-urban-gray-50 py-6">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-urban-gray-500">
            <p>
              Platforma de campanii civice a{" "}
              <a
                href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://implicarecivica.ro"}
                className="text-civic-blue-500 hover:underline"
              >
                implicarecivica.ro
              </a>
            </p>
            <p className="mt-1">
              <a href="/politica-confidentialitate" className="hover:underline">
                Politica de confidențialitate
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
