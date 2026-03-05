'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  User,
  TrendingUp,
  Activity
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

export default function TeamPage() {
  const [stats, setStats] = useState({
    totalChats: 42,
    activeAgents: 3,
    avgResponseTime: '2m 15s',
    completionRate: '94%'
  });

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Desempenho da Equipe</h1>
            <p className="text-zinc-500 mt-1">Acompanhe as métricas e produtividade em tempo real</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total de Conversas', value: stats.totalChats, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Agentes Ativos', value: stats.activeAgents, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Tempo Médio', value: stats.avgResponseTime, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Taxa de Conclusão', value: stats.completionRate, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg, stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-50 flex items-center justify-between">
                <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Atividade Recente
                </h2>
              </div>
              <div className="p-6 space-y-6">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-900">
                        <span className="font-bold">Agente {i + 1}</span> finalizou o atendimento com <span className="font-bold">Cliente {i + 10}</span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Há {i * 5 + 2} minutos atrás</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                <TrendingUp className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Relatórios Detalhados</h3>
              <p className="text-sm text-zinc-500 mt-2 max-w-xs">
                Em breve você poderá exportar relatórios completos de produtividade e satisfação do cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
