'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Lock, ArrowRight } from 'lucide-react';
import { API_URL } from '../../lib/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [syncTime, setSyncTime] = useState<string>('');
  const router = useRouter();

  React.useEffect(() => {
    setSyncTime(new Date().toLocaleTimeString());
    const pingUrl = `${API_URL || window.location.origin}/health-check`;
    fetch(pingUrl)
      .then(async res => {
        if (res.ok) {
          setServerStatus('online');
        } else {
          const text = await res.text().catch(() => 'Erro desconhecido');
          console.error('Server check failed:', res.status, text);
          setServerStatus('offline');
        }
      })
      .catch(err => {
        console.error('Erro no teste de conexão (health-check):', {
          mensagem: err.message,
          url: pingUrl,
          causa: 'Pode ser bloqueio de CORS ou o servidor do Render ainda está iniciando.'
        });
        setServerStatus('offline');
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginUrl = `${API_URL || window.location.origin}/api/auth/login`;
      console.log('Iniciando tentativa de login em:', loginUrl);
      
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('Resposta do servidor:', res.status, res.statusText);

      if (res.ok) {
        router.push('/chats');
      } else {
        const text = await res.text();
        console.error('Falha no login - Resposta detalhada:', { status: res.status, text: text.substring(0, 200) });
        try {
          const data = JSON.parse(text);
          setError(data.error || 'Falha no login');
        } catch (e) {
          setError(`Erro do servidor (${res.status}): ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        }
      }
    } catch (err: any) {
      console.error('Login fetch error:', err);
      setError(`Erro ao conectar ao servidor: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-600/20">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">Bem-vindo (v1.5.6)</h1>
          <p className="text-zinc-500 mt-2">Sincronizado em: {syncTime || '...'}</p>
          {API_URL && <p className="text-[10px] text-zinc-400">API: {API_URL}</p>}
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-emerald-500' : 
              serverStatus === 'offline' ? 'bg-red-500' : 'bg-zinc-300 animate-pulse'
            }`} />
            <span className="text-xs text-zinc-400">
              Servidor: {
                serverStatus === 'online' ? 'Online' : 
                serverStatus === 'offline' ? 'Offline (Verifique o log do navegador)' : 'Verificando...'
              }
            </span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="password"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar na conta'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
