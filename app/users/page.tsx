'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { User, Shield, Edit, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      } else {
        // Handle non-admin access or errors
        setError('Falha ao buscar usuários');
      }
    } catch (err) {
      setError('Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
        resetForm();
      } else {
        const data = await res.json();
        setError(data.error || 'Operação falhou');
      }
    } catch (err) {
      setError('Ocorreu um erro');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Falha ao excluir usuário');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetForm();
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'agent' });
    setError('');
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50 items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-lg font-semibold text-zinc-900">Gerenciamento de Usuários</h1>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Usuário
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900">{user.name}</h3>
                      <p className="text-sm text-zinc-500">{user.email}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    user.role === 'admin' 
                      ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>
                    {user.role === 'admin' ? 'Administrador' : 'Agente'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => openEditModal(user)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <h2 className="font-semibold text-zinc-900">
                    {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      {editingUser ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Função</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'agent' })}
                    >
                      <option value="agent">Agente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors"
                    >
                      {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
