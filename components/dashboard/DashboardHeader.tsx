/**
 * DashboardHeader Component
 * Modern header with dark mode toggle and user greeting
 * Implements F-pattern layout (top-left critical info)
 */

'use client';

import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { Settings, Bell } from 'lucide-react';

interface DashboardHeaderProps {
  userName: string;
  unreadNotifications?: number;
}

export function DashboardHeader({ userName, unreadNotifications = 0 }: DashboardHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
      {/* Left: User greeting (F-pattern top-left - most important) */}
      <div className="flex-1 min-w-[240px]">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white
                       bg-clip-text animate-fade-in">
          Bine ai revenit, {userName}! 👋
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400 animate-fade-in"
           style={{ animationDelay: '50ms' }}>
          Gestionează cererile tale de informații publice
        </p>
      </div>

      {/* Right: Actions (dark mode, notifications, settings) */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className="group relative h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-700
                     transition-all duration-300
                     focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                     active:scale-95"
          aria-label={`Notifications ${unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}`}
        >
          <Bell className="absolute inset-0 m-auto h-4 w-4 text-gray-600 dark:text-gray-400" strokeWidth={2.5} />

          {/* Unread badge */}
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center
                           text-[10px] font-bold text-white
                           bg-protest-red-500 rounded-full
                           animate-pulse-activist">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}

          {/* Hover glow */}
          <div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
                       transition-opacity duration-300 pointer-events-none
                       bg-gradient-to-br from-activist-orange-500/10 to-civic-blue-500/10"
            aria-hidden="true"
          />
        </button>

        {/* Settings */}
        <button
          className="group relative h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-700
                     transition-all duration-300
                     focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                     active:scale-95"
          aria-label="Settings"
        >
          <Settings className="absolute inset-0 m-auto h-4 w-4 text-gray-600 dark:text-gray-400
                              group-hover:rotate-90 transition-transform duration-500"
                    strokeWidth={2.5} />

          {/* Hover glow */}
          <div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
                       transition-opacity duration-300 pointer-events-none
                       bg-gradient-to-br from-activist-orange-500/10 to-civic-blue-500/10"
            aria-hidden="true"
          />
        </button>

        {/* Dark mode toggle */}
        <DarkModeToggle />
      </div>
    </div>
  );
}
