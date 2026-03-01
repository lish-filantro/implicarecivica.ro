"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/campanii/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.isAdmin) {
          router.replace("/campanii/admin/login");
        } else {
          setAuthenticated(true);
        }
      })
      .catch(() => router.replace("/campanii/admin/login"));
  }, [router]);

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
