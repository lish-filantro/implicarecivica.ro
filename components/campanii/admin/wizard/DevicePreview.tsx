"use client";

import { useState } from "react";
import { Smartphone, Monitor } from "lucide-react";

interface DevicePreviewProps {
  children: React.ReactNode;
}

export function DevicePreview({ children }: DevicePreviewProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center gap-2 justify-center">
        <button
          type="button"
          onClick={() => setDevice("mobile")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            device === "mobile"
              ? "bg-civic-blue-600 border-civic-blue-600 text-white"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Mobil
        </button>
        <button
          type="button"
          onClick={() => setDevice("desktop")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            device === "desktop"
              ? "bg-civic-blue-600 border-civic-blue-600 text-white"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          Desktop
        </button>
      </div>

      {/* Device frame */}
      <div className="flex justify-center">
        <div
          className={`bg-gray-100 dark:bg-gray-900 rounded-2xl border-2 border-gray-300 dark:border-gray-600 p-2 transition-all duration-300 ${
            device === "mobile" ? "w-[375px]" : "w-full max-w-3xl"
          }`}
        >
          {/* Screen notch (mobile) */}
          {device === "mobile" && (
            <div className="flex justify-center mb-1">
              <div className="w-20 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
          )}

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden min-h-[400px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
