'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MobileMenuProps {
  items: NavItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="h-9 w-9 rounded-lg flex items-center justify-center
                   hover:bg-gray-100 dark:hover:bg-gray-800
                   transition-colors duration-200
                   focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
        aria-label={open ? 'Inchide meniul' : 'Deschide meniul'}
        aria-expanded={open}
      >
        {open ? (
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-14 border-b border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900 shadow-lg z-40
                        animate-slide-in">
          <nav className="px-4 py-3 space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                             transition-colors duration-200
                             ${isActive
                               ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                             }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
