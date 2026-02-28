'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Mail,
  CalendarDays,
  MessageCircle,
} from 'lucide-react';
import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { UserDropdown } from './UserDropdown';
import { MobileMenu } from './MobileMenu';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Panou', icon: LayoutDashboard },
  { href: '/chat', label: 'Asistent 544', icon: MessageSquare },
  { href: '/requests', label: 'Cereri', icon: FileText },
  { href: '/emails', label: 'Emailuri', icon: Mail },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/feedback', label: 'Feedback', icon: MessageCircle },
];

export function TopNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14
                    bg-white/80 backdrop-blur-sm dark:bg-gray-900/80
                    border-b border-gray-200 dark:border-gray-700">
      <div className="h-full max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Brand + Mobile menu */}
        <div className="flex items-center gap-3">
          <MobileMenu items={NAV_ITEMS} />
          <Link
            href="/dashboard"
            className="font-activist text-lg tracking-tight text-civic-blue-700 dark:text-civic-blue-400
                       hover:text-civic-blue-800 dark:hover:text-civic-blue-300 transition-colors"
          >
            implicarecivica.ro
          </Link>
        </div>

        {/* Center: Nav links (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           transition-all duration-200
                           ${isActive
                             ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                             : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                           }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <UserDropdown />
        </div>
      </div>
    </nav>
  );
}
