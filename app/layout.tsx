import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CookieConsent } from "@/components/shared/CookieConsent";
import "./globals.css";

export const metadata: Metadata = {
  title: "Implicare Civică — Transparență și informații publice",
  description:
    "Platformă civică pentru acces la informații publice conform Legii 544/2001. Trimite cereri, urmărește răspunsuri, responsabilizează instituțiile.",
  keywords: [
    "Legea 544",
    "informații publice",
    "transparență",
    "cereri",
    "România",
    "implicare civică",
  ],
  openGraph: {
    title: "Implicare Civică — Transparență și informații publice",
    description:
      "Platformă civică pentru acces la informații publice conform Legii 544/2001. Trimite cereri, urmărește răspunsuri, responsabilizează instituțiile.",
    url: "https://implicarecivica.ro",
    siteName: "Implicare Civică",
    type: "website",
    locale: "ro_RO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Implicare Civică — Transparență și informații publice",
    description:
      "Platformă civică pentru acces la informații publice conform Legii 544/2001. Trimite cereri, urmărește răspunsuri, responsabilizează instituțiile.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  );
}
