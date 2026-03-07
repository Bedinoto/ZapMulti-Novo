'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  Calendar, 
  Tag,
  X,
  CheckCircle2,
  MoreVertical,
  MessageCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  lastInteraction: number;
  source: 'automatic' | 'manual';
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({ name: '', phoneNumber: '' });
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setContacts(data);
      } else {
        console.error('Expected array of contacts, got:', data);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    const socket = io({ transports: ['polling', 'websocket'] });

    socket.on('whatsapp:contact-new', (contact: Contact) => {
      setContacts(prev => [contact, ...prev]);
    });

    socket.on('whatsapp:contact-updated', (updatedContact: Contact) => {
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    });

    socket.on('whatsapp:contact-deleted', ({ jid }) => {
      setContacts(prev => prev.filter(c => c.id !== jid));
    });

    return () => {
      socket.close();
    };
  }, []);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingContact ? `/api/contacts/${editingContact.id}` : '/api/contacts';
      const method = editingContact ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setEditingContact(null);
        setNewContact({ name: '', phoneNumber: '' });
        fetchContacts();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar contato');
      }
    } catch (err) {
      console.error('Failed to save contact:', err);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Deseja realmente excluir este contato?')) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchContacts();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir contato');
      }
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const handleMessageContact = async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}/chat`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/chats?chatKey=${data.chatKey}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao iniciar conversa');
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setNewContact({ name: contact.name, phoneNumber: contact.phoneNumber });
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const openAddModal = () => {
    setEditingContact(null);
    setNewContact({ name: '', phoneNumber: '' });
    setIsModalOpen(true);
  };

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery)
  );

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Contatos</h1>
              <p className="text-zinc-500 mt-1">Gerencie sua lista de clientes e leads</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Buscar contatos..." 
                  className="pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                Novo Contato
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Contato</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Telefone</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Última Interação</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Origem</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{contact.name}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">ID: {contact.id.split('@')[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-600">
                          <Phone className="w-3.5 h-3.5 opacity-50" />
                          <span className="text-sm font-medium">{contact.phoneNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-600">
                          <Calendar className="w-3.5 h-3.5 opacity-50" />
                          <span className="text-sm font-medium">
                            {new Date(contact.lastInteraction).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          contact.source === 'automatic' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                        )}>
                          {contact.source === 'automatic' ? 'Automático' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 relative">
                          <button 
                            onClick={() => handleMessageContact(contact.id)}
                            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Enviar Mensagem"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button 
                              onClick={() => setActiveDropdown(activeDropdown === contact.id ? null : contact.id)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                activeDropdown === contact.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                              )}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            <AnimatePresence>
                              {activeDropdown === contact.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setActiveDropdown(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-zinc-100 py-2 z-20"
                                  >
                                    <button 
                                      onClick={() => openEditModal(contact)}
                                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4 text-zinc-400" />
                                      Editar Contato
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteContact(contact.id)}
                                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-400" />
                                      Excluir Contato
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredContacts.length === 0 && (
                <div className="p-20 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">Nenhum contato encontrado</h3>
                  <p className="text-zinc-500 mt-2 max-w-xs">Tente ajustar sua busca ou adicione um novo contato manualmente.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingContact ? 'Editar Contato' : 'Novo Contato'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddContact} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: João Silva" 
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Número de Telefone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="text" 
                      required
                      disabled={!!editingContact}
                      placeholder="Ex: 5511999999999" 
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={newContact.phoneNumber}
                      onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 ml-1">Use o formato internacional: Código do País + DDD + Número</p>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    Salvar Contato
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
