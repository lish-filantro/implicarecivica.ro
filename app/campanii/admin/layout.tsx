import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Campanii Civice",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {children}
    </div>
  );
}
