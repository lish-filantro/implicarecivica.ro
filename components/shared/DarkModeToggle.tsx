/**
 * DarkModeToggle Component
 * Smooth toggle between light and dark modes with system preference support
 * Implements modern accessibility practices
 */

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  // Get effective theme (resolves 'system' to actual theme)
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Apply theme to document
  const applyTheme = (newTheme: Theme) => {
    const effectiveTheme = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : newTheme;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // Store preference
    localStorage.setItem('theme', newTheme);
  };

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);

    // Get stored theme or default to system
    const storedTheme = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(storedTheme);
    applyTheme(storedTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = getEffectiveTheme() === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
    );
  }

  const effectiveTheme = getEffectiveTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group relative h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800
                 border border-gray-200 dark:border-gray-700
                 hover:bg-gray-200 dark:hover:bg-gray-700
                 transition-all duration-300
                 focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                 active:scale-95"
      aria-label={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Currently ${effectiveTheme} mode. Click to switch.`}
    >
      {/* Sun icon (visible in dark mode) */}
      <Sun
        className={`absolute inset-0 m-auto h-4 w-4 text-amber-500 transition-all duration-500
                   ${effectiveTheme === 'dark'
                     ? 'rotate-0 scale-100 opacity-100'
                     : 'rotate-90 scale-0 opacity-0'
                   }`}
        strokeWidth={2.5}
      />

      {/* Moon icon (visible in light mode) */}
      <Moon
        className={`absolute inset-0 m-auto h-4 w-4 text-indigo-600 transition-all duration-500
                   ${effectiveTheme === 'light'
                     ? 'rotate-0 scale-100 opacity-100'
                     : '-rotate-90 scale-0 opacity-0'
                   }`}
        strokeWidth={2.5}
      />

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
                   transition-opacity duration-300 pointer-events-none
                   bg-gradient-to-br from-activist-orange-500/10 to-civic-blue-500/10"
        aria-hidden="true"
      />
    </button>
  );
}
