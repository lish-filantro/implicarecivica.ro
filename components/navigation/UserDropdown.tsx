'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

function getInitials(email: string | undefined): string {
  if (!email) return '?';
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

export function UserDropdown() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const initials = getInitials(user?.email);
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5
                   hover:bg-gray-100 dark:hover:bg-gray-800
                   transition-colors duration-200
                   focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="h-7 w-7 rounded-full bg-civic-blue-500 flex items-center justify-center
                        text-xs font-bold text-white">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200
                                 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-800 shadow-lg py-1 z-50
                        animate-fade-in">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user?.email}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Setari
            </Link>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Deconectare
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
