import type { Metadata } from "next";

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
  return <>{children}</>;
}
