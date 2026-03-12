'use client';

import React from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Lock, 
  User, 
  Globe, 
  Smartphone,
  MessageSquare,
  Save
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Configurações</h1>
            <p className="text-zinc-500 mt-1">Personalize sua experiência e gerencie sua conta</p>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-50">
                <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  Preferências de Chat
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { icon: Bell, label: 'Notificações Sonoras', desc: 'Tocar som ao receber novas mensagens', active: true },
                  { icon: Smartphone, label: 'Notificações Push', desc: 'Receber alertas no navegador', active: true },
                  { icon: Globe, label: 'Auto-atribuição', desc: 'Atribuir conversas novas automaticamente', active: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{item.label}</p>
                        <p className="text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    </div>
                    <button className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      item.active ? "bg-emerald-600" : "bg-zinc-200"
                    )}>
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        item.active ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                <Save className="w-5 h-5" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
