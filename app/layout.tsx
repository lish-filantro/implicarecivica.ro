import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CookieConsent } from "@/components/shared/CookieConsent";
import "./globals.css";

export const metadata: Metadata = {
  title: "544 Cereri Informații Publice",
  description: "Platformă pentru gestionarea cererilor de informații publice conform Legii 544/2001",
  keywords: ["Legea 544", "informații publice", "transparență", "cereri", "România"],
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
