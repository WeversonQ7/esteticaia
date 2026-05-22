'use client';

import { User } from '@supabase/supabase-js';
import { Bell, Menu, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface HeaderProps {
  user: User;
}

export function Header({ user }: HeaderProps) {
  const [notificacoes] = useState(3);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-muted-foreground lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      <div className="flex flex-1 gap-x-4 self-stretch items-center justify-end">
        <div className="flex items-center gap-x-4">
          {/* Status do WhatsApp */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            WhatsApp Online
          </div>

          {/* Notificações */}
          <button
            type="button"
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {notificacoes > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                {notificacoes}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
