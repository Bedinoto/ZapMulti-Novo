'use client';

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Smartphone, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  User,
  MessageSquare,
  QrCode
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr';
  qrCode?: string;
  userInfo?: any;
  error?: string;
}

export default function ConnectionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const newSocket = io({ transports: ['polling', 'websocket'] });
    setSocket(newSocket);

    newSocket.on('whatsapp:session-status', (data: any) => {
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === data.sessionId);
        if (index === -1) {
          return [...prev, { id: data.sessionId, status: data.status, qrCode: data.qr, userInfo: data.user, error: data.error }];
        }
        const newSessions = [...prev];
        newSessions[index] = { ...newSessions[index], status: data.status, qrCode: data.qr, userInfo: data.user, error: data.error };
        return newSessions;
      });
    });

    newSocket.on('whatsapp:session-removed', ({ sessionId }) => {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleAddConnection = async () => {
    try {
      const res = await fetch('/api/connections', { method: 'POST' });
      if (res.ok) fetchSessions();
    } catch (err) {
      console.error('Failed to add connection:', err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Deseja remover esta conexão?')) return;
    try {
      const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSessions();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  const handleRepairConnection = async (id: string) => {
    if (!confirm('Deseja reparar esta conexão? Isso tentará resolver erros de descriptografia e Bad MAC limpando as chaves de sessão locais.')) return;
    try {
      const res = await fetch(`/api/connections/${id}/repair`, { method: 'POST' });
      if (res.ok) {
        alert('Reparo iniciado. A conexão será reiniciada em instantes.');
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to repair connection:', err);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Conexões WhatsApp</h1>
              <p className="text-zinc-500 mt-1">Gerencie seus dispositivos e sessões ativas</p>
            </div>
            <button
              onClick={handleAddConnection}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-5 h-5" />
              Nova Conexão
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-20">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <div 
                  key={session.id}
                  className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      session.status === 'connected' ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                    )}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        session.status === 'connected' ? "bg-emerald-50 text-emerald-600" :
                        session.status === 'qr' ? "bg-amber-50 text-amber-600" :
                        "bg-zinc-50 text-zinc-500"
                      )}>
                        {session.status === 'connected' ? 'Conectado' :
                         session.status === 'qr' ? 'Aguardando QR' :
                         session.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                      </span>
                      <button 
                        onClick={() => handleDeleteConnection(session.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {session.status === 'connected' && (
                      <button 
                        onClick={() => handleRepairConnection(session.id)}
                        className="w-full mb-4 flex items-center justify-center gap-2 py-2 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-semibold transition-all border border-zinc-200"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reparar Conexão (Fix Decryption/MAC)
                      </button>
                    )}
                    {session.status === 'qr' && session.qrCode ? (
                      <div className="flex flex-col items-center p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                        <img src={session.qrCode} alt="QR Code" className="w-48 h-48 mb-4" />
                        <p className="text-xs text-center text-zinc-500">Escaneie o código com seu WhatsApp para conectar</p>
                      </div>
                    ) : session.status === 'disconnected' && session.error === 'QR_EXPIRED' ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center bg-amber-50 rounded-2xl border border-amber-100">
                        <AlertCircle className="w-8 h-8 mb-3 text-amber-600" />
                        <p className="text-sm font-bold text-amber-900">QR Code Expirado</p>
                        <p className="text-xs text-amber-700 mt-1 mb-4">O tempo para escanear o código acabou. Tente novamente.</p>
                        <button 
                          onClick={() => handleRepairConnection(session.id)}
                          className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-all"
                        >
                          Gerar Novo QR Code
                        </button>
                      </div>
                    ) : session.status === 'connected' && session.userInfo ? (
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{session.userInfo.name || 'Dispositivo WA'}</p>
                            <p className="text-xs text-zinc-500">ID: {session.userInfo.id.split('@')[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium">Sessão ativa e sincronizada</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 flex flex-col items-center justify-center text-zinc-400">
                        <Clock className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">Aguardando inicialização...</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-50 flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                    <span>Sessão ID: {session.id.slice(-6)}</span>
                    <div className="flex items-center gap-1">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        session.status === 'connected' ? "bg-emerald-500" : "bg-zinc-300"
                      )} />
                      Status em tempo real
                    </div>
                  </div>
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="col-span-full bg-white rounded-3xl p-12 border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">Nenhuma conexão ativa</h3>
                  <p className="text-zinc-500 mt-2 max-w-xs">Clique no botão "Nova Conexão" para começar a gerenciar seus dispositivos.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
