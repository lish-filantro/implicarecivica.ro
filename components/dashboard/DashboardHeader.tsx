'use client';

import { Bell } from 'lucide-react';

interface DashboardHeaderProps {
  userName: string;
  unreadNotifications?: number;
}

export function DashboardHeader({ userName, unreadNotifications = 0 }: DashboardHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
      {/* Left: User greeting */}
      <div className="flex-1 min-w-[240px]">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white animate-fade-in">
          Bine ai revenit, {userName}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400 animate-fade-in"
           style={{ animationDelay: '50ms' }}>
          Gestioneaza cererile tale de informatii publice
        </p>
      </div>

      {/* Right: Contextual notifications */}
      {unreadNotifications > 0 && (
        <div className="flex items-center gap-2">
          <button
            className="group relative h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-all duration-300
                       focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                       active:scale-95"
            aria-label={`Notificari (${unreadNotifications} necitite)`}
          >
            <Bell className="absolute inset-0 m-auto h-4 w-4 text-gray-600 dark:text-gray-400" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center
                             text-[10px] font-bold text-white
                             bg-protest-red-500 rounded-full
                             animate-pulse-activist">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
