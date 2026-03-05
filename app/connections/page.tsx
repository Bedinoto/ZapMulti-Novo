'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Link2, Plus } from 'lucide-react';

export default function ConnectionsPage() {
  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Conexões</h1>
              <p className="text-zinc-500">Gerencie suas instâncias do WhatsApp e integrações de API.</p>
            </div>
            <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" />
              Nova Conexão
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="bg-emerald-50 p-3 rounded-xl">
                  <Link2 className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Conectado
                </span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-1">WhatsApp Principal</h3>
              <p className="text-sm text-zinc-500 mb-4">ID da Instância: wa_main_01</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 text-sm font-medium text-zinc-600 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors">
                  Configurações
                </button>
                <button className="flex-1 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  Desconectar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
