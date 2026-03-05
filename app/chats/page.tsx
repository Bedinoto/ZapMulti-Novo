'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Video, 
  User,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  CheckCircle2,
  Trash2,
  CheckCircle,
  Paperclip,
  File,
  X,
  Image as ImageIcon,
  Download,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface Message {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: any;
    videoMessage?: any;
    audioMessage?: any;
    documentMessage?: any;
  };
  messageTimestamp: number;
  pushName?: string;
  status?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
}

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  messages: Message[];
  assignedTo?: string;
  assignedToName?: string;
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedChatId, chats]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    fetch('/api/whatsapp/status')
      .then(res => res.json())
      .then(data => {
        if (data.chats) setChats(data.chats);
      });

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setCurrentUser(data));

    newSocket.on('whatsapp:message', (msg: Message) => {
      const jid = msg.key.remoteJid;
      setChats(prev => {
        const chat = prev[jid] || {
          id: jid,
          name: msg.pushName || jid.split('@')[0],
          unreadCount: 0,
          messages: []
        };

        const text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     (msg.message?.imageMessage ? '📷 Foto' : '') ||
                     (msg.message?.documentMessage ? '📄 Documento' : '') || '';
        
        // Prevent duplicates
        const msgExists = chat.messages.some(m => m.key.id === msg.key.id);
        const newMessages = msgExists ? chat.messages : [...chat.messages, msg];

        return {
          ...prev,
          [jid]: {
            ...chat,
            lastMessage: text,
            timestamp: msg.messageTimestamp,
            messages: newMessages.slice(-50)
          }
        };
      });
    });

    newSocket.on('whatsapp:chat-deleted', ({ jid }) => {
      setChats(prev => {
        const newChats = { ...prev };
        delete newChats[jid];
        return newChats;
      });
      if (selectedChatId === jid) {
        setSelectedChatId(null);
      }
    });

    newSocket.on('whatsapp:chat-assigned', ({ jid, userId, userName }) => {
      setChats(prev => {
        if (!prev[jid]) return prev;
        return {
          ...prev,
          [jid]: {
            ...prev[jid],
            assignedTo: userId,
            assignedToName: userName
          }
        };
      });
    });

    return () => {
      newSocket.close();
    };
  }, [selectedChatId]);

  const filteredChats = Object.values(chats)
    .filter(chat => {
      const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isVisible = !chat.assignedTo || chat.assignedTo === currentUser?.id || currentUser?.role === 'admin';
      return matchesSearch && isVisible;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const selectedChat = selectedChatId ? chats[selectedChatId] : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !selectedChatId) return;

    if (selectedChat?.assignedTo && selectedChat.assignedTo !== currentUser?.id && currentUser?.role !== 'admin') {
      alert('Esta conversa está atribuída a outro agente.');
      return;
    }

    const text = messageInput;
    const file = selectedFile;

    // Reset state immediately
    setMessageInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const sendRequest = async (body: any) => {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Falha ao enviar mensagem');
        }
      } catch (err) {
        console.error('Falha ao enviar mensagem:', err);
      }
    };

    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        await sendRequest({
          jid: selectedChatId,
          text,
          media: base64,
          mediaType: file.type.startsWith('image/') ? 'image' : 'document',
          fileName: file.name,
          mimeType: file.type
        });
      };
    } else {
      await sendRequest({ jid: selectedChatId, text });
    }
  };

  const handleClaimChat = async (jid: string) => {
    try {
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(jid)}/assign`, {
        method: 'POST'
      });
      if (!res.ok) {
        alert('Falha ao aceitar conversa');
      }
    } catch (err) {
      console.error('Falha ao aceitar conversa:', err);
    }
  };

  const handleFinishChat = async (jid: string) => {
    if (confirm('Deseja finalizar este atendimento? A conversa será removida da sua lista.')) {
      try {
        const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(jid)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setSelectedChatId(null);
        }
      } catch (err) {
        console.error('Falha ao finalizar conversa:', err);
      }
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      
      {/* Chat List */}
      <div className="w-96 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChatId(chat.id)}
              className={cn(
                "w-full p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50",
                selectedChatId === chat.id && "bg-emerald-50/50 hover:bg-emerald-50/50"
              )}
            >
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-zinc-900 truncate">{chat.name}</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {chat.timestamp ? new Date(chat.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500 truncate flex-1">{chat.lastMessage}</p>
                  {chat.assignedTo && (
                    <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {chat.assignedTo === currentUser?.id ? 'Eu' : (chat.assignedToName || 'Agente')}
                    </span>
                  )}
                </div>
              </div>
              {chat.unreadCount > 0 && (
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                  {chat.unreadCount}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-zinc-50">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="h-20 bg-white border-b border-zinc-200 px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">{selectedChat.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-xs text-zinc-500">Online agora</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!selectedChat.assignedTo && (
                  <button 
                    onClick={() => handleClaimChat(selectedChat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Aceitar
                  </button>
                )}
                {selectedChat.assignedTo && selectedChat.assignedTo !== currentUser?.id && (
                  <span className="text-xs text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-xl">
                    Atribuído a outro agente
                  </span>
                )}
                <button 
                  onClick={() => handleFinishChat(selectedChat.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Finalizar Atendimento"
                >
                  <CheckCircle className="w-4 h-4" />
                  Finalizar
                </button>
                <div className="w-px h-6 bg-zinc-200 mx-2" />
                <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedChat.messages.map((msg, i) => {
                const isMe = msg.key.fromMe;
                const text = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text || 
                             (msg.message?.imageMessage ? '📷 Foto' : '') ||
                             (msg.message?.videoMessage ? '🎥 Vídeo' : '') ||
                             (msg.message?.audioMessage ? '🎤 Áudio' : '') ||
                             (msg.message?.documentMessage ? '📄 Documento' : '') || '';
                
                // If there's no text and no media, skip
                if (!text && !msg.mediaUrl) return null;

                return (
                  <div
                    key={msg.key.id}
                    className={cn(
                      "flex flex-col max-w-[70%]",
                      isMe ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl text-sm shadow-sm overflow-hidden",
                        isMe 
                          ? "bg-emerald-600 text-white rounded-tr-none" 
                          : "bg-white text-zinc-900 rounded-tl-none border border-zinc-200"
                      )}
                    >
                      {msg.mediaUrl && msg.mediaType === 'image' && (
                        <div 
                          className="mb-2 -mx-2 -mt-2 group relative cursor-pointer overflow-hidden rounded-t-lg" 
                          onClick={() => setPreviewImage(msg.mediaUrl || null)}
                        >
                          <img 
                            src={msg.mediaUrl} 
                            alt="Foto" 
                            className="w-full h-auto max-h-64 object-cover transition-transform duration-300 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                          </div>
                        </div>
                      )}

                      {msg.mediaUrl && msg.mediaType === 'video' && (
                        <div className="mb-2 -mx-2 -mt-2">
                          <video 
                            src={msg.mediaUrl} 
                            controls
                            className="w-full h-auto max-h-64 object-cover" 
                          />
                        </div>
                      )}

                      {msg.mediaUrl && msg.mediaType === 'audio' && (
                        <div className="flex items-center gap-2 mb-1 min-w-[200px]">
                           <audio 
                            src={msg.mediaUrl} 
                            controls
                            className="w-full h-8" 
                          />
                        </div>
                      )}
                      
                      {msg.mediaUrl && msg.mediaType === 'document' && (
                        <div className="flex items-center gap-3 mb-2 p-2 bg-black/5 rounded-lg">
                          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-zinc-500">
                            <File className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs">{msg.fileName || 'Documento'}</p>
                            <a 
                              href={msg.mediaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] underline opacity-70 hover:opacity-100"
                            >
                              Baixar
                            </a>
                          </div>
                        </div>
                      )}

                      {text && (msg.mediaType !== 'image' && msg.mediaType !== 'video' && msg.mediaType !== 'audio' && msg.mediaType !== 'document' || (text !== '📷 Foto' && text !== '🎥 Vídeo' && text !== '🎤 Áudio' && text !== '📄 Documento')) && (
                        <p>{text}</p>
                      )}
                      
                      {/* Show caption if it exists and is different from placeholder */}
                      {msg.message?.imageMessage?.caption && (
                        <p className="mt-1">{msg.message.imageMessage.caption}</p>
                      )}
                      {msg.message?.videoMessage?.caption && (
                        <p className="mt-1">{msg.message.videoMessage.caption}</p>
                      )}
                      {msg.message?.documentMessage?.caption && (
                        <p className="mt-1">{msg.message.documentMessage.caption}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-zinc-400">
                        {new Date(msg.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        <div className="text-zinc-400">
                          {msg.status === 4 ? (
                            <CheckCheck className="w-3 h-3 text-emerald-500" />
                          ) : msg.status === 3 ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Modal */}
            <AnimatePresence>
              {previewImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                  onClick={() => setPreviewImage(null)}
                >
                  <button 
                    className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
                    onClick={() => setPreviewImage(null)}
                  >
                    <X className="w-6 h-6" />
                  </button>
                  
                  <motion.img 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    src={previewImage} 
                    alt="Preview" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} 
                  />
                  
                  <div 
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={previewImage}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-white text-black rounded-full font-medium flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Original
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-6 bg-white border-t border-zinc-200">
              {selectedFile && (
                <div className="mb-4 p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                      {selectedFile.type.startsWith('image/') ? <ImageIcon className="w-5 h-5" /> : <File className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() && !selectedFile}
                  className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
              <MessageSquare className="w-12 h-12 text-zinc-200" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900">Selecione uma conversa</h3>
            <p className="text-sm">Escolha uma conversa da lista para começar a enviar mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
