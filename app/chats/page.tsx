'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { 
  Search, Send, MoreVertical, Phone, Video, User, Check, CheckCheck, 
  MessageSquare, CheckCircle, Paperclip, File, X, Image as ImageIcon, Download, Maximize2,
  Play, Pause, Volume2, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import Sidebar from '../../components/Sidebar';
import { cn } from '../../lib/utils';
import { API_URL } from '../../lib/config';

interface Message {
  key: { remoteJid: string; fromMe: boolean; id: string; };
  message?: { conversation?: string; extendedTextMessage?: { text: string; }; imageMessage?: any; videoMessage?: any; audioMessage?: any; documentMessage?: any; };
  messageTimestamp: number;
  pushName?: string;
  status?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
  quotedMessageId?: string;
  quotedMessageText?: string;
  sessionId?: string;
  chatKey?: string;
}

const AudioPlayer = ({ src, isMe }: { src: string; isMe: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-1 min-w-[240px]",
      isMe ? "text-white" : "text-zinc-900"
    )}>
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <button 
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0",
          isMe ? "bg-white/20 hover:bg-white/30" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={cn(
          "h-1.5 w-full rounded-full overflow-hidden relative",
          isMe ? "bg-white/20" : "bg-zinc-100"
        )}>
          <div 
            className={cn("h-full absolute left-0 top-0 transition-all", isMe ? "bg-white" : "bg-emerald-500")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] opacity-70 font-medium">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <Volume2 className="w-4 h-4 opacity-50 shrink-0" />
    </div>
  );
};

interface Chat {
  id: string; sessionId?: string; key?: string; name: string; lastMessage: string; timestamp: number; unreadCount: number; messages: Message[]; assignedTo?: string; assignedToName?: string;
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    soundEnabled: true,
    pushEnabled: true,
    autoAssign: false
  });
  const settingsRef = useRef(chatSettings);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update ref whenever state changes and save to localStorage
  useEffect(() => {
    settingsRef.current = chatSettings;
    localStorage.setItem('chat_settings', JSON.stringify(chatSettings));
  }, [chatSettings]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [selectedChatId, chats]);

  useEffect(() => {
    // Load settings
    const savedSettings = localStorage.getItem('chat_settings');
    if (savedSettings) {
      setChatSettings(JSON.parse(savedSettings));
    }

    // Som de notificação - Tenta local primeiro, depois fallbacks externos
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3');
    audio.volume = 0.6;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    notificationSound.current = audio;

    const fallbacks = [
      'https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3',
      'https://cdn.pixabay.com/audio/2022/03/15/audio_78390a2431.mp3',
      'https://www.soundjay.com/buttons/sounds/button-09a.mp3'
    ];
    let currentFallbackIndex = 0;

    audio.addEventListener('error', (e) => {
      console.error('Erro ao carregar áudio:', audio.src, e);
      if (currentFallbackIndex < fallbacks.length) {
        console.log(`Tentando fallback ${currentFallbackIndex + 1}...`);
        audio.src = fallbacks[currentFallbackIndex];
        currentFallbackIndex++;
        audio.load();
      } else {
        console.error('Todos os fallbacks de áudio falharam.');
      }
    });

    // Tenta carregar o áudio
    audio.load();

    const unlockAudio = () => {
      if (notificationSound.current) {
        notificationSound.current.play()
          .then(() => {
            notificationSound.current!.pause();
            notificationSound.current!.currentTime = 0;
            setAudioUnlocked(true);
            console.log('Áudio desbloqueado com sucesso!');
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
          })
          .catch(err => console.log('Aguardando interação para desbloquear áudio...'));
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Use API_URL for socket connection
    const newSocket = io(API_URL || undefined, { 
      transports: ['polling', 'websocket'],
      withCredentials: true 
    });
    setSocket(newSocket);
    
    fetch(`${API_URL}/api/whatsapp/status`, { credentials: 'include' }).then(res => {
      if (res.status === 401) { window.location.href = '/login'; return; }
      return res.json();
    }).then(data => { if (data && data.chats) setChats(data.chats); });
    
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' }).then(res => {
      if (res.status === 401) { window.location.href = '/login'; return; }
      return res.json();
    }).then(data => { if (data) setCurrentUser(data); });

    newSocket.on('whatsapp:message', (msg: any) => {
      console.log('Nova mensagem recebida:', msg);
      if (!msg?.key) return;
      const jid = msg.key.remoteJid;
      const chatKey = msg.chatKey || jid;

      // Extract quoted message info if not already present
      if (!msg.quotedMessageId) {
        msg.quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 
                             msg.message?.imageMessage?.contextInfo?.stanzaId ||
                             msg.message?.videoMessage?.contextInfo?.stanzaId ||
                             msg.message?.audioMessage?.contextInfo?.stanzaId ||
                             msg.message?.documentMessage?.contextInfo?.stanzaId;
      }
      if (!msg.quotedMessageText) {
        msg.quotedMessageText = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
                               msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;
      }
      
      if (msg.key && !msg.key.fromMe) {
        const currentSettings = settingsRef.current;
        console.log('Configurações atuais:', currentSettings);

        // Play sound if enabled
        if (currentSettings.soundEnabled) {
          console.log('Tentando reproduzir som de notificação...');
          if (notificationSound.current) {
            notificationSound.current.currentTime = 0;
            notificationSound.current.play().catch(err => {
              console.warn('Reprodução de áudio automática bloqueada pelo navegador.', err);
            });
          }
        }

        // Show push notification if enabled
        if (currentSettings.pushEnabled && Notification.permission === 'granted') {
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Nova mídia recebida';
          new Notification(msg.pushName || 'Nova Mensagem', {
            body: text,
            icon: '/favicon.ico'
          });
        }
      }

      setChats(prev => {
        const chat = prev[chatKey] || { id: jid, sessionId: msg.sessionId, key: chatKey, name: msg.pushName || jid.split('@')[0], unreadCount: 0, messages: [] };
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? '📷 Foto' : '') || (msg.message?.videoMessage ? '🎥 Vídeo' : '') || (msg.message?.audioMessage ? '🎤 Áudio' : '') || (msg.message?.documentMessage ? '📄 Documento' : '') || '';
        const msgExists = chat.messages.some(m => m.key?.id === msg.key.id);
        const newMessages = msgExists ? chat.messages : [...chat.messages, msg];
        const newTimestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000);
        return { ...prev, [chatKey]: { ...chat, lastMessage: text, timestamp: newTimestamp, messages: newMessages.slice(-50) } };
      });
    });

    newSocket.on('whatsapp:chat-deleted', ({ jid, chatKey }) => {
      const keyToDelete = chatKey || jid;
      setChats(prev => { const newChats = { ...prev }; delete newChats[keyToDelete]; return newChats; });
      setSelectedChatId(prev => (prev === keyToDelete ? null : prev));
    });

    newSocket.on('whatsapp:chat-updated', (updatedChat: Chat) => {
      setChats(prev => ({ ...prev, [updatedChat.key || updatedChat.id]: updatedChat }));
    });

    newSocket.on('whatsapp:chats-synced', () => {
      fetch('/api/whatsapp/status').then(res => res.json()).then(data => {
        if (data && data.chats) setChats(data.chats);
      });
    });

    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    const chatKey = searchParams.get('chatKey');
    if (chatKey) {
      setSelectedChatId(chatKey);
    }
  }, [searchParams]);

  const filteredChats = Object.values(chats)
    .filter(chat => {
      const chatName = chat.name || '';
      const chatId = chat.id || '';
      const matchesSearch = 
        chatName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        chatId.toLowerCase().includes(searchQuery.toLowerCase());
      if (!currentUser) return false;
      
      if (currentUser.role === 'admin') return matchesSearch;
      
      // Agents see their own chats OR unassigned chats
      const isAssignedToMe = chat.assignedTo === currentUser.id;
      const isUnassigned = !chat.assignedTo;
      
      return matchesSearch && (isAssignedToMe || isUnassigned);
    })
    .sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeB - timeA;
    });

  const selectedChat = selectedChatId ? chats[selectedChatId] : null;

  const handleAcceptChat = async (chatKey: string) => {
    try {
      const res = await fetch(`/api/whatsapp/chats/${chatKey}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Erro ao aceitar conversa', 'error');
      }
    } catch (err) {
      console.error('Erro ao aceitar conversa:', err);
    }
  };

  const handleRejectChat = async (chatKey: string) => {
    try {
      const res = await fetch(`/api/whatsapp/chats/${chatKey}/reject`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Erro ao rejeitar conversa', 'error');
      }
    } catch (err) {
      console.error('Erro ao rejeitar conversa:', err);
    }
  };

  const handleFinishChat = async (chatKey: string) => {
    setShowConfirm({
      message: 'Deseja realmente finalizar e excluir esta conversa?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/whatsapp/chats/${chatKey}`, { method: 'DELETE' });
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Erro ao finalizar conversa', 'error');
          } else {
            setSelectedChatId(null);
            showToast('Conversa finalizada com sucesso');
          }
        } catch (err) {
          console.error('Erro ao finalizar conversa:', err);
          showToast('Erro ao finalizar conversa', 'error');
        }
        setShowConfirm(null);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setUploadPreview(url);
      } else {
        setUploadPreview(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !selectedChatId) return;
    const text = messageInput;
    const file = selectedFile;
    const quotedId = replyingTo?.key.id;
    setMessageInput(''); 
    clearSelectedFile();
    setReplyingTo(null);
    const sendRequest = async (body: any) => {
      try {
        const res = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { 
          const data = await res.json(); 
          showToast(data.error || 'Falha ao enviar', 'error'); 
        }
      } catch (err) { console.error('Falha ao enviar:', err); }
    };
    const commonBody = { jid: selectedChat!.id, sessionId: selectedChat!.sessionId, text, quotedMessageId: quotedId };
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-zinc-900">Mensagens</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  if (notificationSound.current) {
                    notificationSound.current.currentTime = 0;
                    notificationSound.current.play()
                      .then(() => {
                        setAudioUnlocked(true);
                        showToast('Som reproduzido com sucesso!', 'success');
                      })
                      .catch(err => {
                        console.error('Erro ao testar som:', err);
                        showToast('Erro ao tocar som. Clique na página e tente novamente.', 'error');
                      });
                  }
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm",
                  audioUnlocked 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200"
                )}
                title="Testar som de notificação"
              >
                <Volume2 className={cn("w-3 h-3", audioUnlocked && "animate-pulse")} />
                {audioUnlocked ? 'Som Ativo' : 'Testar Som'}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                title="Configurações de Chat"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input type="text" placeholder="Buscar nome ou telefone..." className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div 
              key={chat.key || chat.id} 
              role="button"
              tabIndex={0}
              onClick={() => setSelectedChatId(chat.key || chat.id)} 
              onKeyDown={(e) => e.key === 'Enter' && setSelectedChatId(chat.key || chat.id)}
              className={cn(
                "w-full p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50 cursor-pointer", 
                selectedChatId === (chat.key || chat.id) && "bg-emerald-50/50 hover:bg-emerald-50/50"
              )}
            >
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 shrink-0 relative">
                <User className="w-6 h-6" />
                {chat.assignedTo && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center" title={`Atribuído a: ${chat.assignedToName}`}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-zinc-900 truncate">{chat.name || 'Sem nome'}</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {isMounted && chat.timestamp && !isNaN(chat.timestamp) && chat.timestamp > 0 
                      ? new Date(chat.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 truncate">{chat.lastMessage}</p>
                {chat.assignedToName && (
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">Atendido por: {chat.assignedToName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-zinc-50">
        {selectedChat ? (
          <>
            <div className="h-20 bg-white border-b border-zinc-200 px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500"><User className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-zinc-900">{selectedChat.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-xs text-zinc-500">
                      {selectedChat.assignedTo ? `Em atendimento por ${selectedChat.assignedToName}` : 'Aguardando atendimento'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!selectedChat.assignedTo ? (
                  <button 
                    onClick={() => handleAcceptChat(selectedChat.key || selectedChat.id)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aceitar Conversa
                  </button>
                ) : (
                  (currentUser?.role === 'admin' || selectedChat.assignedTo === currentUser?.id) && (
                    <>
                      <button 
                        onClick={() => handleRejectChat(selectedChat.key || selectedChat.id)}
                        className="px-4 py-2 bg-zinc-100 text-zinc-600 text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Liberar
                      </button>
                      <button 
                        onClick={() => handleFinishChat(selectedChat.key || selectedChat.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-all flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Finalizar
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedChat.messages.map((msg) => {
                if (!msg?.key) return null;
                const isMe = msg.key.fromMe;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? '📷 Foto' : '') || (msg.message?.videoMessage ? '🎥 Vídeo' : '') || (msg.message?.audioMessage ? '🎤 Áudio' : '') || (msg.message?.documentMessage ? '📄 Documento' : '') || '';
                if (!text && !msg.mediaUrl) return null;
                return (
                  <div key={msg.key.id} id={`msg-${msg.key.id}`} className={cn("flex flex-col max-w-[70%] group", isMe ? "ml-auto items-end" : "items-start")}>
                    <div className="flex items-center gap-2 w-full">
                      {!isMe && (
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className="p-1.5 bg-white border border-zinc-200 rounded-full text-zinc-400 opacity-0 group-hover:opacity-100 transition-all hover:text-emerald-600 hover:border-emerald-200 shadow-sm"
                          title="Responder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className={cn("px-4 py-2 rounded-2xl text-sm shadow-sm overflow-hidden flex-1", isMe ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-zinc-900 rounded-tl-none border border-zinc-200")}>
                        {(msg.quotedMessageId || msg.quotedMessageText) && (
                          <div 
                            className={cn(
                              "mb-2 p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:bg-opacity-80 transition-all",
                              isMe ? "bg-black/20 border-white/40 text-white/90" : "bg-zinc-100 border-emerald-500 text-zinc-500"
                            )}
                            onClick={() => {
                              const element = document.getElementById(`msg-${msg.quotedMessageId}`);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                element.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
                                setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 2000);
                              }
                            }}
                          >
                            <p className={cn("font-bold mb-0.5", isMe ? "text-white" : "text-emerald-600")}>
                              {msg.quotedMessageText ? 'Mensagem respondida' : 'Mídia respondida'}
                            </p>
                            <p className="truncate italic">
                              {msg.quotedMessageText || 'Visualizar mídia'}
                            </p>
                          </div>
                        )}
                        {msg.mediaUrl && msg.mediaType === 'image' && (
                        <Image 
                          src={msg.mediaUrl} 
                          alt="Foto" 
                          width={500}
                          height={500}
                          className="w-full h-auto max-h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => setPreviewImage(msg.mediaUrl || null)} 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {msg.mediaUrl && msg.mediaType === 'video' && (
                        <video 
                          src={msg.mediaUrl} 
                          controls 
                          className="w-full h-auto max-h-64 rounded-lg bg-black"
                        />
                      )}
                      {msg.mediaUrl && msg.mediaType === 'audio' && (
                        <AudioPlayer src={msg.mediaUrl} isMe={isMe} />
                      )}
                      {msg.mediaUrl && msg.mediaType === 'document' && (
                        <a 
                          href={msg.mediaUrl} 
                          download={msg.fileName || 'documento'}
                          className="flex items-center gap-3 p-2 bg-zinc-50 rounded-xl border border-zinc-100 hover:bg-zinc-100 transition-colors text-zinc-900"
                        >
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-zinc-200">
                            <File className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{msg.fileName || 'Documento'}</p>
                            <p className="text-[10px] text-zinc-500 uppercase">Baixar arquivo</p>
                          </div>
                          <Download className="w-4 h-4 text-zinc-400" />
                        </a>
                      )}
                      {text && <p className={cn(msg.mediaUrl && "mt-2")}>{text}</p>}
                    </div>
                    {isMe && (
                      <button 
                        onClick={() => setReplyingTo(msg)}
                        className="p-1.5 bg-white border border-zinc-200 rounded-full text-zinc-400 opacity-0 group-hover:opacity-100 transition-all hover:text-emerald-600 hover:border-emerald-200 shadow-sm"
                        title="Responder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1">
                    {isMounted ? new Date(msg.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-6 bg-white border-t border-zinc-200">
              {(!selectedChat.assignedTo && currentUser?.role !== 'admin') ? (
                <div className="flex flex-col items-center justify-center py-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <p className="text-sm text-zinc-500 mb-3 text-center px-4">Você precisa aceitar esta conversa para poder enviar mensagens.</p>
                  <button 
                    onClick={() => handleAcceptChat(selectedChat.key || selectedChat.id)}
                    className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aceitar Agora
                  </button>
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    {replyingTo && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-4 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3 relative"
                      >
                        <div className="w-1 h-10 bg-emerald-500 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Respondendo para {replyingTo.key.fromMe ? 'você' : (replyingTo.pushName || 'Contato')}</p>
                          <p className="text-sm text-zinc-600 truncate italic">
                            {replyingTo.message?.conversation || replyingTo.message?.extendedTextMessage?.text || (replyingTo.mediaType ? `Mídia (${replyingTo.mediaType})` : 'Mensagem')}
                          </p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setReplyingTo(null)}
                          className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                    {selectedFile && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-4 p-3 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center gap-3 relative group"
                      >
                        {uploadPreview ? (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 bg-white relative">
                            <Image src={uploadPreview} alt="Preview" fill className="object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400">
                            <File className="w-8 h-8" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{selectedFile.name}</p>
                          <p className="text-xs text-zinc-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={clearSelectedFile}
                          className="p-2 bg-white border border-zinc-200 rounded-full text-zinc-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"><Paperclip className="w-5 h-5" /></button>
                    <input type="text" placeholder="Digite uma mensagem..." className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                    <button type="submit" disabled={!messageInput.trim() && !selectedFile} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" /></button>
                  </form>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <div className="bg-white p-6 rounded-full shadow-sm mb-4"><MessageSquare className="w-12 h-12 text-zinc-200" /></div>
            <h3 className="text-lg font-medium text-zinc-900">Selecione uma conversa</h3>
          </div>
        )}
      </div>
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600" />
                  Configurações de Chat
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">Som de Notificação</p>
                    <p className="text-xs text-zinc-500">Tocar um som ao receber novas mensagens</p>
                  </div>
                  <div 
                    role="button"
                    tabIndex={0}
                    onClick={() => setChatSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                    onKeyDown={(e) => e.key === 'Enter' && setChatSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                      chatSettings.soundEnabled ? "bg-emerald-500" : "bg-zinc-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      chatSettings.soundEnabled ? "right-1" : "left-1"
                    )} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">Notificações Push</p>
                    <p className="text-xs text-zinc-500">Mostrar alertas do navegador</p>
                  </div>
                  <div 
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!chatSettings.pushEnabled && Notification.permission !== 'granted') {
                        Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                            setChatSettings(prev => ({ ...prev, pushEnabled: true }));
                          }
                        });
                      } else {
                        setChatSettings(prev => ({ ...prev, pushEnabled: !prev.pushEnabled }));
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (/* handle push toggle */ true)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                      chatSettings.pushEnabled ? "bg-emerald-500" : "bg-zinc-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      chatSettings.pushEnabled ? "right-1" : "left-1"
                    )} />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 min-w-[300px]",
              toast.type === 'error' ? "bg-red-600 text-white" : "bg-zinc-900 text-white"
            )}
          >
            {toast.type === 'error' ? <X className="w-5 h-5" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">Confirmar Ação</h3>
                <p className="text-sm text-zinc-500">{showConfirm.message}</p>
              </div>
              <div className="p-4 bg-zinc-50 flex gap-3">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-3 bg-white border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-zinc-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={showConfirm.onConfirm}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
