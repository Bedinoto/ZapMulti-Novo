'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Search, Send, MoreVertical, Phone, Video, User, Check, CheckCheck, 
  MessageSquare, CheckCircle, Paperclip, File, X, Image as ImageIcon, Download, Maximize2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface Message {
  key: { remoteJid: string; fromMe: boolean; id: string; };
  message?: { conversation?: string; extendedTextMessage?: { text: string; }; imageMessage?: any; videoMessage?: any; audioMessage?: any; documentMessage?: any; };
  messageTimestamp: number;
  pushName?: string;
  status?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
  sessionId?: string;
  chatKey?: string;
}

interface Chat {
  id: string; sessionId?: string; key?: string; name: string; lastMessage: string; timestamp: number; unreadCount: number; messages: Message[]; assignedTo?: string; assignedToName?: string;
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [selectedChatId, chats]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    fetch('/api/whatsapp/status').then(res => res.json()).then(data => { if (data.chats) setChats(data.chats); });
    fetch('/api/auth/me').then(res => res.json()).then(data => setCurrentUser(data));

    newSocket.on('whatsapp:message', (msg: Message) => {
      const jid = msg.key.remoteJid;
      const chatKey = msg.chatKey || jid;
      setChats(prev => {
        const chat = prev[chatKey] || { id: jid, sessionId: msg.sessionId, key: chatKey, name: msg.pushName || jid.split('@')[0], unreadCount: 0, messages: [] };
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? '📷 Foto' : '') || (msg.message?.videoMessage ? '🎥 Vídeo' : '') || (msg.message?.audioMessage ? '🎤 Áudio' : '') || (msg.message?.documentMessage ? '📄 Documento' : '') || '';
        const msgExists = chat.messages.some(m => m.key.id === msg.key.id);
        const newMessages = msgExists ? chat.messages : [...chat.messages, msg];
        return { ...prev, [chatKey]: { ...chat, lastMessage: text, timestamp: msg.messageTimestamp, messages: newMessages.slice(-50) } };
      });
    });

    newSocket.on('whatsapp:chat-deleted', ({ jid, chatKey }) => {
      const keyToDelete = chatKey || jid;
      setChats(prev => { const newChats = { ...prev }; delete newChats[keyToDelete]; return newChats; });
      if (selectedChatId === keyToDelete) setSelectedChatId(null);
    });

    newSocket.on('whatsapp:chat-updated', (updatedChat: Chat) => {
      setChats(prev => ({ ...prev, [updatedChat.key || updatedChat.id]: updatedChat }));
    });

    return () => { newSocket.close(); };
  }, [selectedChatId]);

  const filteredChats = Object.values(chats)
    .filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.timestamp - a.timestamp);

  const selectedChat = selectedChatId ? chats[selectedChatId] : null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !selectedChatId) return;
    const text = messageInput;
    const file = selectedFile;
    setMessageInput(''); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '';
    const sendRequest = async (body: any) => {
      try {
        const res = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { const data = await res.json(); alert(data.error || 'Falha ao enviar'); }
      } catch (err) { console.error('Falha ao enviar:', err); }
    };
    const commonBody = { jid: selectedChat!.id, sessionId: selectedChat!.sessionId, text };
    if (file) {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        await sendRequest({ ...commonBody, media: base64, mediaType: file.type.startsWith('image/') ? 'image' : 'document', fileName: file.name, mimeType: file.type });
      };
    } else await sendRequest(commonBody);
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      <div className="w-96 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input type="text" placeholder="Buscar conversas..." className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <button key={chat.key || chat.id} onClick={() => setSelectedChatId(chat.key || chat.id)} className={cn("w-full p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50", selectedChatId === (chat.key || chat.id) && "bg-emerald-50/50 hover:bg-emerald-50/50")}>
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 shrink-0"><User className="w-6 h-6" /></div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-zinc-900 truncate">{chat.name || 'Sem nome'}</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {chat.timestamp && !isNaN(chat.timestamp) && chat.timestamp > 0 
                      ? new Date(chat.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 truncate">{chat.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-zinc-50">
        {selectedChat ? (
          <>
            <div className="h-20 bg-white border-b border-zinc-200 px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500"><User className="w-5 h-5" /></div>
                <div><h3 className="font-bold text-zinc-900">{selectedChat.name}</h3><div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-xs text-zinc-500">Online agora</span></div></div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedChat.messages.map((msg) => {
                const isMe = msg.key.fromMe;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? '📷 Foto' : '') || (msg.message?.videoMessage ? '🎥 Vídeo' : '') || (msg.message?.audioMessage ? '🎤 Áudio' : '') || (msg.message?.documentMessage ? '📄 Documento' : '') || '';
                if (!text && !msg.mediaUrl) return null;
                return (
                  <div key={msg.key.id} className={cn("flex flex-col max-w-[70%]", isMe ? "ml-auto items-end" : "items-start")}>
                    <div className={cn("px-4 py-2 rounded-2xl text-sm shadow-sm overflow-hidden", isMe ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-zinc-900 rounded-tl-none border border-zinc-200")}>
                      {msg.mediaUrl && msg.mediaType === 'image' && <img src={msg.mediaUrl} alt="Foto" className="w-full h-auto max-h-64 object-cover rounded-lg" onClick={() => setPreviewImage(msg.mediaUrl || null)} />}
                      {text && <p>{text}</p>}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1">{new Date(msg.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-6 bg-white border-t border-zinc-200">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"><Paperclip className="w-5 h-5" /></button>
                <input type="text" placeholder="Digite uma mensagem..." className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                <button type="submit" disabled={!messageInput.trim() && !selectedFile} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <div className="bg-white p-6 rounded-full shadow-sm mb-4"><MessageSquare className="w-12 h-12 text-zinc-200" /></div>
            <h3 className="text-lg font-medium text-zinc-900">Selecione uma conversa</h3>
          </div>
        )}
      </div>
    </div>
  );
}
