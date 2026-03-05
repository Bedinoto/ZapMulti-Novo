'use client';

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Link2, 
  LayoutDashboard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { motion } from 'motion/react';

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    fetch('/api/whatsapp/status')
      .then(res => res.json())
      .then(data => setStatus(data));

    newSocket.on('whatsapp:status', (data) => {
      setStatus((prev: any) => ({ ...prev, ...data }));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const stats = [
    { label: 'Total de Conversas', value: status?.chats ? Object.keys(status.chats).length : 0, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Equipe Ativa', value: '4', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Conexões', value: status?.status === 'connected' ? '1' : '0', icon: Link2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900">Painel de Controle</h1>
            <p className="text-zinc-500">Bem-vindo de volta ao seu Gerenciador WhatsApp.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={stat.label}
                className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={stat.bg + " p-3 rounded-xl"}>
                    <stat.icon className={stat.color + " w-6 h-6"} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-zinc-900">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                Status da Conexão
              </h2>
              
              <div className="flex flex-col items-center justify-center py-8">
                {status?.status === 'connected' ? (
                  <div className="text-center">
                    <div className="bg-emerald-50 p-4 rounded-full inline-block mb-4">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Conectado</h3>
                    <p className="text-zinc-500 mb-4">Você está conectado como {status.user?.name || status.user?.id}</p>
                  </div>
                ) : status?.status === 'qr' ? (
                  <div className="text-center">
                    <div className="bg-zinc-100 p-4 rounded-2xl inline-block mb-4 border-2 border-dashed border-zinc-300">
                      <img src={status.qr} alt="QR Code" className="w-64 h-64" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Escaneie o QR Code</h3>
                    <p className="text-zinc-500">Abra o WhatsApp no seu celular e escaneie o código para conectar.</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="bg-zinc-50 p-4 rounded-full inline-block mb-4">
                      <Loader2 className="w-12 h-12 text-zinc-400 animate-spin" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Conectando...</h3>
                    <p className="text-zinc-500">Por favor, aguarde enquanto estabelecemos a conexão.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-xl font-bold mb-6">Atividade Recente</h2>
              <div className="space-y-4">
                {status?.chats && Object.values(status.chats).slice(0, 5).map((chat: any) => (
                  <div key={chat.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-colors">
                    <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                      {chat.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-zinc-900">{chat.name}</div>
                      <div className="text-sm text-zinc-500 truncate max-w-[200px]">{chat.lastMessage}</div>
                    </div>
                    <div className="text-xs text-zinc-400">
                      {new Date(chat.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {!status?.chats || Object.keys(status.chats).length === 0 && (
                  <div className="text-center py-8 text-zinc-400 italic">
                    Nenhuma atividade recente encontrada.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
