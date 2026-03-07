'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Mail, 
  Shield, 
  Trash2, 
  Edit2, 
  MoreVertical,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'agent' as const });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          console.error('Expected array of users, got:', data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetch('/api/auth/me')
      .then(res => {
        if (res.status === 401) { window.location.href = '/login'; return; }
        return res.json();
      })
      .then(data => { if (data) setCurrentUser(data); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', role: 'agent' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar usuário');
      }
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir usuário');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (currentUser?.role !== 'admin' && !loading) {
    return (
      <div className="flex h-screen bg-zinc-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-zinc-900">Acesso Negado</h1>
            <p className="text-zinc-500 mt-2">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Gestão de Usuários</h1>
              <p className="text-zinc-500 mt-1">Gerencie os acessos e permissões da sua equipe</p>
            </div>
            <button 
              onClick={() => {
                setEditingUser(null);
                setFormData({ name: '', email: '', password: '', role: 'agent' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-5 h-5" />
              Novo Usuário
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50/50 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4">Função</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                            <User className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-zinc-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          user.role === 'admin' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                        )}>
                          <Shield className="w-3 h-3" />
                          {user.role === 'admin' ? 'Administrador' : 'Agente'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Ativo
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Senha {editingUser && '(deixe em branco para manter)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Função</label>
                <select
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'agent' })}
                >
                  <option value="agent">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-sm font-semibold hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
