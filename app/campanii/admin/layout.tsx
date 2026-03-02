import type { Metadata } from "next";
import { AdminShell } from "@/components/campanii/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin | Campanii Civice",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
