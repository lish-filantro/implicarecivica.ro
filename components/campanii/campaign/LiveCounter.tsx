"use client";

import { useEffect, useState } from "react";

interface LiveCounterProps {
  count: number;
  label?: string;
}

export function LiveCounter({ count, label = "persoane au trimis emailul" }: LiveCounterProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (displayed === count) return;

    const step = Math.max(1, Math.floor((count - displayed) / 20));
    const timer = setTimeout(() => {
      setDisplayed((prev) => Math.min(prev + step, count));
    }, 30);

    return () => clearTimeout(timer);
  }, [count, displayed]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-4xl md:text-5xl font-bold text-activist-orange-500">
        {displayed}
      </span>
      <span className="text-lg text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}
