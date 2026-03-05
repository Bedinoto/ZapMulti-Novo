'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Link2, 
  LayoutDashboard,
  LogOut,
  UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(() => {});
  }, []);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: MessageSquare, label: 'Conversas', href: '/chats' },
    // { icon: Users, label: 'Team', href: '/team' }, // Removed placeholder
    { icon: Link2, label: 'Conexões', href: '/connections' },
    // { icon: Settings, label: 'Settings', href: '/settings' }, // Removed placeholder
  ];

  if (user?.role === 'admin') {
    menuItems.push({ icon: UserCog, label: 'Usuários', href: '/users' });
  }

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    }
  };

  return (
    <div className="w-64 h-screen bg-white border-r border-zinc-200 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          WA Manager
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
