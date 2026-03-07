'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Settings, 
  Users, 
  LogOut, 
  LayoutDashboard,
  Link as LinkIcon,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: MessageSquare, label: 'Conversas', href: '/chats' },
  { icon: Users, label: 'Contatos', href: '/contacts' },
  { icon: LinkIcon, label: 'Conexões', href: '/connections' },
  { icon: Shield, label: 'Usuários', href: '/users' },
  { icon: Settings, label: 'Configurações', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="w-20 lg:w-64 bg-white border-r border-zinc-200 flex flex-col h-full transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0">
          <MessageSquare className="w-6 h-6" />
        </div>
        <span className="font-bold text-xl text-zinc-900 hidden lg:block">WA Manager</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all group",
              pathname === item.href 
                ? "bg-emerald-50 text-emerald-600" 
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-colors",
              pathname === item.href ? "text-emerald-600" : "group-hover:text-zinc-900"
            )} />
            <span className="font-medium hidden lg:block">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:text-red-600" />
          <span className="font-medium hidden lg:block">Sair</span>
        </button>
      </div>
    </div>
  );
}
